//! Orchestrates downloads: metadata fetch, queueing under the parallel limit, spawning yt-dlp,
//! turning its output into persisted state and UI events, and pause / resume / cancel.
//!
//! This replaces `useDownloader` in `src/hooks/use-downloader.ts`. All process and UI access goes
//! through the [`Runner`] and [`Events`] traits so the whole flow is testable without yt-dlp.

use super::args::{
    build_download_args, build_metadata_args, playlist_selection, ArgsContext, DownloadRequest,
    MetadataRequest,
};
use super::model::{DownloadConfig, FileType};
use super::parser::{parse_line, Line};
use super::process::OutputLine;
use super::repo::{
    DownloadRecord, DownloadState, PlaylistInfoRow, ProgressRow, Repo, VideoInfoRow,
};
use super::state::{
    exit_outcome, is_last_item, nonzero_f64, nonzero_i64, slots_available, ExitOutcome, Intent, Status,
    Throttle,
};
use super::video::{effective_ext, generate_video_id, resume_from_state, VideoMeta};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::io;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, oneshot, Mutex};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ExitInfo {
    pub success: bool,
    pub code: Option<i32>,
}

/// A started child: its output lines (closed at EOF of both pipes) and its eventual exit.
pub struct Spawned {
    pub pid: u32,
    pub lines: mpsc::Receiver<OutputLine>,
    pub exit: oneshot::Receiver<ExitInfo>,
}

/// How yt-dlp gets started and stopped.
pub trait Runner: Send + Sync + 'static {
    fn spawn(&self, args: Vec<String>) -> io::Result<Spawned>;
    /// Terminates the process tree; the exit is reported through [`Spawned::exit`].
    fn kill(&self, pid: u32);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warning,
    Error,
    Progress,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProgressEvent {
    pub download_id: String,
    pub status: Option<String>,
    pub item: Option<String>,
    pub progress: Option<f64>,
    pub speed: Option<f64>,
    pub downloaded: Option<i64>,
    pub total: Option<i64>,
    pub eta: Option<i64>,
}

/// Everything the UI is told about.
pub trait Events: Send + Sync + 'static {
    /// A download changed status (or was created / its file path became known).
    fn state(&self, state: &DownloadState);
    /// Live progress, throttled.
    fn progress(&self, event: &ProgressEvent);
    /// A download row was deleted (cancelled).
    fn removed(&self, download_id: &str);
    fn log(&self, level: LogLevel, source: &str, message: &str);
}

#[derive(Debug, Clone, Default)]
pub struct Paths {
    pub temp_dir: String,
    pub download_dir: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StartParams {
    pub url: String,
    pub selected_format: String,
    pub download_config: DownloadConfig,
    pub selected_subtitles: Option<String>,
    pub playlist_items: Option<String>,
    pub override_tbr: Option<f64>,
    pub override_filesize: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MetadataParams {
    pub url: String,
    pub format_id: Option<String>,
    pub playlist_indices: Option<String>,
    pub selected_subtitles: Option<String>,
    pub download_config: Option<DownloadConfig>,
}

struct Job {
    pid: Option<u32>,
    intent: Option<super::state::Intent>,
}

struct Inner<R, E> {
    repo: Repo,
    runner: R,
    events: E,
    is_macos: bool,
    paths: StdMutex<Paths>,
    /// Downloads that currently hold a slot (spawning or running).
    jobs: StdMutex<HashMap<String, Job>>,
    /// Serialises queue draining so two callers can't start the same queued download.
    queue_lock: Mutex<()>,
    search_pid: StdMutex<Option<u32>>,
    /// Set on quit so freed slots aren't refilled while processes are being stopped.
    shutting_down: AtomicBool,
}

pub struct Manager<R, E> {
    inner: Arc<Inner<R, E>>,
}

impl<R, E> Clone for Manager<R, E> {
    fn clone(&self) -> Self {
        Self { inner: self.inner.clone() }
    }
}

const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(250);
const PROGRESS_PERSIST_INTERVAL: Duration = Duration::from_secs(1);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);
const APP: &str = "NEODLP";

fn db_err(e: sqlx::Error) -> String {
    e.to_string()
}

fn non_empty(s: &Option<String>) -> Option<String> {
    s.clone().filter(|s| !s.is_empty())
}

fn progress_event(id: &str, row: &ProgressRow) -> ProgressEvent {
    ProgressEvent {
        download_id: id.into(),
        status: row.status.clone(),
        item: row.item.clone(),
        progress: row.progress,
        speed: row.speed,
        downloaded: row.downloaded,
        total: row.total,
        eta: row.eta,
    }
}

/// Rebuilds the start parameters of a stored download (queued, paused or errored).
fn params_from_state(s: &DownloadState) -> StartParams {
    let r = &s.record;
    let is_playlist = r.playlist_id.is_some() && r.playlist_indices.is_some();
    let url = match (&s.playlist_url, is_playlist) {
        (Some(playlist_url), true) => playlist_url.clone(),
        _ => s.url.clone(),
    };
    StartParams {
        url,
        selected_format: r.format_id.clone(),
        download_config: r
            .queue_config
            .as_deref()
            .and_then(|c| serde_json::from_str(c).ok())
            .unwrap_or_default(),
        selected_subtitles: r.subtitle_id.clone(),
        ..Default::default()
    }
}

/// What `prepare` settled on; everything `launch` needs.
struct Prepared {
    id: String,
    args: Vec<String>,
    start_now: bool,
    is_playlist: bool,
    initial_item: Option<String>,
    log_progress: bool,
}

impl<R: Runner, E: Events> Inner<R, E> {
    fn args_context(&self) -> ArgsContext {
        let paths = self.paths.lock().unwrap().clone();
        ArgsContext { is_macos: self.is_macos, temp_dir: paths.temp_dir, download_dir: paths.download_dir }
    }

    /// The UI reports the download folders after it starts; nothing may run before that, or
    /// yt-dlp would be given empty `--paths`.
    fn paths_ready(&self) -> bool {
        let paths = self.paths.lock().unwrap();
        !paths.temp_dir.is_empty() && !paths.download_dir.is_empty()
    }

    fn release(&self, id: &str) {
        self.jobs.lock().unwrap().remove(id);
    }

    async fn emit_state(&self, id: &str) {
        match self.repo.fetch_by_id(id).await {
            Ok(Some(state)) => self.events.state(&state),
            Ok(None) => {}
            Err(e) => log::warn!("Could not load download {id} to notify the UI: {e}"),
        }
    }

    /// Runs yt-dlp and returns the JSON object it prints on stdout.
    async fn fetch_json(&self, args: Vec<String>, url: &str) -> Result<Value, String> {
        self.events.log(
            LogLevel::Info,
            APP,
            &format!("Fetching metadata for URL: {url}, with args: {}", args.join(" ")),
        );
        let mut spawned = self.runner.spawn(args).map_err(|e| {
            let msg = format!("Failed to start yt-dlp for fetching metadata for URL: {url} : {e}");
            self.events.log(LogLevel::Error, APP, &msg);
            msg
        })?;
        let pid = spawned.pid;
        *self.search_pid.lock().unwrap() = Some(pid);

        let mut json: Option<String> = None;
        while let Some(line) = spawned.lines.recv().await {
            match line {
                OutputLine::Stdout(l) if l.starts_with('{') => json = Some(l),
                OutputLine::Stdout(l) | OutputLine::Stderr(l) => {
                    if !l.trim().is_empty() {
                        self.events.log(LogLevel::Info, "YT-DLP", &l);
                    }
                }
            }
        }
        {
            let mut current = self.search_pid.lock().unwrap();
            if *current == Some(pid) {
                *current = None;
            }
        }

        match spawned.exit.await {
            Ok(exit) if exit.success => self.events.log(
                LogLevel::Info,
                APP,
                &format!("yt-dlp exited with code 0 while fetching metadata for URL: {url}"),
            ),
            exit => self.events.log(
                LogLevel::Error,
                APP,
                &format!(
                    "yt-dlp exited with code {} while fetching metadata for URL: {url} (ignore if you manually cancelled)",
                    exit.ok().and_then(|e| e.code).map_or("unknown".into(), |c| c.to_string())
                ),
            ),
        }

        let fail = |msg: String| {
            self.events.log(LogLevel::Error, APP, &msg);
            "yt-dlp failed to fetch video metadata".to_string()
        };
        let json = json.ok_or_else(|| fail(format!("Failed to parse metadata JSON for URL: {url}")))?;
        // Tolerate stray text around the object, like the old `/{.*}/` match did.
        let slice = match (json.find('{'), json.rfind('}')) {
            (Some(start), Some(end)) if end >= start => &json[start..=end],
            _ => return Err(fail(format!("Failed to parse metadata JSON for URL: {url}"))),
        };
        serde_json::from_str(slice)
            .map_err(|e| fail(format!("Failed to parse metadata JSON for URL: {url} with error: {e}")))
    }
}

/// Frees the slot, records the failure and lets the queue move on.
async fn fail_download<R: Runner, E: Events>(inner: &Arc<Inner<R, E>>, id: &str, msg: &str) {
    inner.release(id);
    inner.events.log(LogLevel::Error, &format!("YT-DLP Download {id}"), msg);
    if let Ok(true) = inner.repo.set_status(id, Status::Errored.as_str(), Some(msg)).await {
        let _ = inner.repo.set_process_id(id, None).await;
        inner.emit_state(id).await;
    }
    schedule_fill(inner.clone());
}

/// Starts queued downloads in the background (a plain fn so async call chains can't become recursive).
fn schedule_fill<R: Runner, E: Events>(inner: Arc<Inner<R, E>>) {
    tokio::spawn(async move { fill_queue(inner).await });
}

/// Starts queued downloads, in order, while slots are free.
async fn fill_queue<R: Runner, E: Events>(inner: Arc<Inner<R, E>>) {
    let _guard = inner.queue_lock.lock().await;
    if inner.shutting_down.load(Ordering::SeqCst) || !inner.paths_ready() {
        return; // `set_paths` triggers another pass once the folders are known
    }
    let max_parallel = match inner.repo.load_settings().await {
        Ok(s) => s.max_parallel_downloads as usize,
        Err(e) => {
            log::warn!("Could not read settings to process the queue: {e}");
            return;
        }
    };

    loop {
        if slots_available(inner.jobs.lock().unwrap().len(), max_parallel) == 0 {
            break;
        }
        let next = match inner.repo.list_queued().await {
            Ok(queued) => {
                let jobs = inner.jobs.lock().unwrap();
                queued.into_iter().find(|s| !jobs.contains_key(&s.record.download_id))
            }
            Err(e) => {
                log::warn!("Could not read the download queue: {e}");
                break;
            }
        };
        let Some(next) = next else { break };
        let id = next.record.download_id.clone();

        // Take the slot before doing anything slow so nobody else can claim it.
        inner.jobs.lock().unwrap().insert(id.clone(), Job { pid: None, intent: None });
        if let Err(e) = inner.repo.set_status(&id, Status::Starting.as_str(), None).await {
            log::warn!("Could not mark queued download {id} as starting: {e}");
            inner.release(&id);
            break;
        }
        inner.emit_state(&id).await;
        inner.events.log(LogLevel::Info, APP, &format!("Starting queued download with id: {id}"));

        let manager = Manager { inner: inner.clone() };
        tokio::spawn(async move {
            // Failures are handled inside (the download is marked errored and its slot freed).
            let _ = manager.begin(params_from_state(&next), Some(next), true).await;
        });
    }
}

impl<R: Runner, E: Events> Manager<R, E> {
    pub fn new(repo: Repo, runner: R, events: E, is_macos: bool) -> Self {
        Self {
            inner: Arc::new(Inner {
                repo,
                runner,
                events,
                is_macos,
                paths: StdMutex::new(Paths::default()),
                jobs: StdMutex::new(HashMap::new()),
                queue_lock: Mutex::new(()),
                search_pid: StdMutex::new(None),
                shutting_down: AtomicBool::new(false),
            }),
        }
    }

    /// Records where downloads go and starts any queued downloads that were waiting for it.
    /// Must be called from within the async runtime.
    pub fn set_paths(&self, paths: Paths) {
        *self.inner.paths.lock().unwrap() = paths;
        schedule_fill(self.inner.clone());
    }

    /// Number of downloads currently holding a slot.
    #[cfg(test)]
    pub fn running_count(&self) -> usize {
        self.inner.jobs.lock().unwrap().len()
    }

    pub async fn fetch_video_metadata(&self, p: MetadataParams) -> Result<Value, String> {
        let settings = self.inner.repo.load_settings().await.map_err(db_err)?;
        let args = build_metadata_args(
            &settings,
            &MetadataRequest {
                url: p.url.clone(),
                format_id: p.format_id,
                playlist_indices: p.playlist_indices,
                selected_subtitles: p.selected_subtitles,
                resume_state: None,
                download_config: p.download_config,
            },
            &self.inner.args_context(),
        );
        self.inner.fetch_json(args, &p.url).await
    }

    /// Every stored download, newest first.
    pub async fn list_states(&self) -> Result<Vec<DownloadState>, String> {
        self.inner.repo.fetch_all().await.map_err(db_err)
    }

    /// Kills an in-flight metadata fetch (the search "cancel" button).
    pub fn cancel_metadata_fetch(&self) {
        let pid = self.inner.search_pid.lock().unwrap().take();
        if let Some(pid) = pid {
            self.inner.runner.kill(pid);
        }
    }

    /// Fetches metadata, records the download and starts it (or queues it). Returns the download id.
    pub async fn start_download(&self, p: StartParams) -> Result<String, String> {
        self.begin(p, None, false).await
    }

    pub async fn pause_download(&self, id: &str) -> Result<(), String> {
        let inner = &self.inner;
        self.inner.events.log(LogLevel::Info, APP, &format!("Pausing yt-dlp download with id: {id} (as per user request)"));
        if self.signal_job(id, Intent::Pause) {
            return Ok(()); // the exit handler records the new status
        }
        let state = inner.repo.fetch_by_id(id).await.map_err(db_err)?.ok_or("Download not found")?;
        if state.record.download_status != Status::Completed.as_str() {
            inner.repo.set_status(id, Status::Paused.as_str(), None).await.map_err(db_err)?;
            inner.emit_state(id).await;
        }
        Ok(())
    }

    pub async fn resume_download(&self, id: &str) -> Result<(), String> {
        self.inner.events.log(LogLevel::Info, APP, &format!("Resuming yt-dlp download with id: {id} (as per user request)"));
        if self.inner.jobs.lock().unwrap().contains_key(id) {
            return Ok(());
        }
        let state = self.inner.repo.fetch_by_id(id).await.map_err(db_err)?.ok_or("Download not found")?;
        self.begin(params_from_state(&state), Some(state), false).await.map(|_| ())
    }

    pub async fn cancel_download(&self, id: &str) -> Result<(), String> {
        let inner = &self.inner;
        inner.events.log(LogLevel::Info, APP, &format!("Cancelling yt-dlp download with id: {id} (as per user request)"));
        if self.signal_job(id, Intent::Cancel) {
            return Ok(());
        }
        inner.repo.delete_download(id).await.map_err(db_err)?;
        inner.events.removed(id);
        schedule_fill(inner.clone());
        Ok(())
    }

    /// Startup: downloads a previous run left mid-flight become paused; queued ones start.
    pub async fn recover(&self) {
        match self.inner.repo.recover_interrupted().await {
            Ok(n) if n > 0 => {
                self.inner.events.log(LogLevel::Info, APP, &format!("Paused {n} download(s) interrupted by the last shutdown"));
            }
            Ok(_) => {}
            Err(e) => log::warn!("Could not recover interrupted downloads: {e}"),
        }
        fill_queue(self.inner.clone()).await;
    }

    /// App quit: pauses everything (running and queued) and waits briefly for processes to exit.
    pub async fn shutdown(&self) {
        let inner = &self.inner;
        inner.shutting_down.store(true, Ordering::SeqCst);
        let pids: Vec<u32> = {
            let mut jobs = inner.jobs.lock().unwrap();
            jobs.values_mut()
                .filter_map(|job| {
                    job.intent = Some(Intent::Pause);
                    job.pid
                })
                .collect()
        };
        for pid in pids {
            inner.runner.kill(pid);
        }
        let drained = tokio::time::timeout(SHUTDOWN_TIMEOUT, async {
            loop {
                let empty = inner.jobs.lock().unwrap().is_empty();
                if empty {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await;
        if drained.is_err() {
            log::warn!("Timed out waiting for downloads to stop");
        }
        for result in [inner.repo.pause_queued().await, inner.repo.recover_interrupted().await] {
            if let Err(e) = result {
                log::warn!("Could not pause downloads on shutdown: {e}");
            }
        }
    }

    /// Records the user's intent for a running download and stops its process. Returns whether the
    /// download holds a slot. If the process isn't spawned yet, `launch` stops it right after.
    fn signal_job(&self, id: &str, intent: Intent) -> bool {
        let pid = {
            let mut jobs = self.inner.jobs.lock().unwrap();
            let Some(job) = jobs.get_mut(id) else { return false };
            job.intent = Some(intent);
            job.pid
        };
        if let Some(pid) = pid {
            self.inner.runner.kill(pid);
        }
        true
    }

    /// Prepares a download and, if a slot is free, launches it. On error the download (if it exists)
    /// has already been marked errored and its slot freed.
    async fn begin(
        &self,
        p: StartParams,
        existing: Option<DownloadState>,
        reserved: bool,
    ) -> Result<String, String> {
        let existing_id = existing.as_ref().map(|s| s.record.download_id.clone());
        let prepared = match self.prepare(&p, &existing, reserved).await {
            Ok(prepared) => prepared,
            Err(msg) => {
                if let (true, Some(id)) = (reserved, existing_id) {
                    fail_download(&self.inner, &id, &msg).await;
                }
                return Err(msg);
            }
        };
        if !prepared.start_now {
            return Ok(prepared.id);
        }
        match self.launch(&prepared).await {
            Ok(()) => Ok(prepared.id),
            Err(msg) => {
                fail_download(&self.inner, &prepared.id, &msg).await;
                Err(msg)
            }
        }
    }

    /// Fetches metadata, decides between starting and queueing, and persists the download.
    async fn prepare(
        &self,
        p: &StartParams,
        existing: &Option<DownloadState>,
        reserved: bool,
    ) -> Result<Prepared, String> {
        let inner = &self.inner;
        if !inner.paths_ready() {
            return Err("The download folders aren't ready yet. Please try again in a moment.".into());
        }
        let settings = inner.repo.load_settings().await.map_err(db_err)?;
        let ctx = inner.args_context();
        let resume = existing.as_ref().map(resume_from_state);
        let items = p.playlist_items.as_deref().filter(|s| !s.is_empty());
        let (is_playlist, indices) = playlist_selection(items, resume.as_ref());
        let indices = indices.map(String::from);

        inner.events.log(LogLevel::Info, APP, &format!("Initiating yt-dlp download for URL: {}", p.url));
        let metadata_args = build_metadata_args(
            &settings,
            &MetadataRequest {
                url: p.url.clone(),
                format_id: (!is_playlist || p.selected_format != "best").then(|| p.selected_format.clone()),
                playlist_indices: if is_playlist { indices.clone() } else { None },
                selected_subtitles: p.selected_subtitles.clone(),
                resume_state: resume.clone(),
                download_config: None,
            },
            &ctx,
        );
        let json = inner.fetch_json(metadata_args, &p.url).await?;
        let meta = VideoMeta::from_json(&json, is_playlist)
            .ok_or_else(|| "yt-dlp returned unexpected video metadata".to_string())?;

        let download_id = resume
            .as_ref()
            .and_then(|r| r.download_id.clone())
            .unwrap_or_else(|| ulid::Ulid::generate().to_string());
        let plan = build_download_args(
            &settings,
            &DownloadRequest {
                url: p.url.clone(),
                download_id: download_id.clone(),
                selected_format: p.selected_format.clone(),
                selected_subtitles: p.selected_subtitles.clone(),
                playlist_items: p.playlist_items.clone(),
                download_config: p.download_config.clone(),
                resume_state: resume.clone(),
                vcodec: meta.vcodec.clone(),
                acodec: meta.acodec.clone(),
                duration: meta.duration,
            },
            &ctx,
        );
        let file_type = plan.file_type.unwrap_or(FileType::Unknown);

        let video_id = resume
            .as_ref()
            .and_then(|r| r.video_id.clone())
            .unwrap_or_else(|| generate_video_id(&meta.id, &meta.domain));
        let playlist_id = is_playlist.then(|| {
            resume.as_ref().and_then(|r| r.playlist_id.clone()).unwrap_or_else(|| {
                generate_video_id(meta.playlist_id.as_deref().unwrap_or_default(), &meta.domain)
            })
        });

        // Claim a slot (or decide to queue) atomically, only after the slow metadata fetch.
        let (start_now, queued_len) = if reserved {
            (true, 0)
        } else {
            let queued = inner.repo.list_queued().await.map_err(db_err)?;
            let mut jobs = inner.jobs.lock().unwrap();
            let free = slots_available(jobs.len(), settings.max_parallel_downloads as usize) > 0;
            if free && queued.is_empty() {
                jobs.insert(download_id.clone(), Job { pid: None, intent: None });
                (true, 0)
            } else {
                (false, queued.len())
            }
        };

        let base = existing.as_ref().map(|s| s.record.clone()).unwrap_or_default();
        let half_tbr = p.override_tbr.map(|t| t / 2.0).filter(|t| t.is_finite() && *t != 0.0);
        let abr = nonzero_f64(base.abr).or(half_tbr);
        let vbr = nonzero_f64(base.vbr).or(half_tbr);
        let filesize = nonzero_i64(base.filesize).or(p.override_filesize.filter(|s| *s != 0));
        let queue_config = non_empty(&base.queue_config).or_else(|| serde_json::to_string(&p.download_config).ok());
        let initial_item = base.item.clone();

        let mut record = DownloadRecord {
            download_id: download_id.clone(),
            video_id: video_id.clone(),
            format_id: p.selected_format.clone(),
            subtitle_id: non_empty(&p.selected_subtitles),
            playlist_id: playlist_id.clone(),
            playlist_indices: indices.clone(),
            process_id: None,
            filepath: None,
            error_message: None,
            completed_at: None,
            abr,
            vbr,
            filesize,
            ..base
        };
        if start_now {
            record.download_status = Status::Starting.as_str().into();
            record.queue_index = None;
            record.queue_config = None;
            record.resolution = meta.resolution.clone();
            record.ext = effective_ext(meta.ext.as_deref(), file_type, &settings, &p.download_config, resume.as_ref());
            record.abr = abr.or(meta.abr);
            record.vbr = vbr.or(meta.vbr);
            record.acodec = meta.acodec.clone();
            record.vcodec = meta.vcodec.clone();
            record.dynamic_range = meta.dynamic_range.clone();
            record.filesize = filesize.or(meta.filesize_approx);
            record.filetype = Some(file_type.as_str().into());
            record.output_format = plan.output_format.clone();
            record.embed_metadata = plan.embed_metadata as i64;
            record.embed_thumbnail = plan.embed_thumbnail as i64;
            record.square_crop_thumbnail = plan.square_crop_thumbnail as i64;
            record.sponsorblock_remove = plan.sponsorblock_remove.clone();
            record.sponsorblock_mark = plan.sponsorblock_mark.clone();
            record.use_aria2 = plan.use_aria2 as i64;
            record.custom_command = plan.custom_command.clone();
            record.trim_stamps = plan.trim_stamps.clone();
        } else {
            record.download_status = Status::Queued.as_str().into();
            record.queue_index = Some(queued_len as i64);
            record.queue_config = queue_config;
        }

        let saved = async {
            inner
                .repo
                .save_video_info(&VideoInfoRow {
                    video_id,
                    title: meta.title.clone(),
                    url: p.url.clone(),
                    host: meta.domain.clone(),
                    thumbnail: meta.thumbnail.clone(),
                    channel: meta.channel.clone(),
                    duration_string: meta.duration_string.clone(),
                    release_date: meta.release_date.clone(),
                    view_count: meta.view_count,
                    like_count: meta.like_count,
                })
                .await?;
            if let Some(playlist_id) = playlist_id {
                inner
                    .repo
                    .save_playlist_info(&PlaylistInfoRow {
                        playlist_id,
                        playlist_title: meta.playlist_title.clone().unwrap_or_default(),
                        playlist_url: meta.playlist_url.clone().unwrap_or_default(),
                        playlist_n_entries: meta.playlist_n_entries.unwrap_or(0),
                        playlist_channel: meta.playlist_info_channel.clone(),
                    })
                    .await?;
            }
            inner.repo.save_download(&record).await
        }
        .await;
        if let Err(e) = saved {
            if !reserved && start_now {
                inner.release(&download_id);
            }
            return Err(db_err(e));
        }
        inner.emit_state(&download_id).await;
        if !start_now {
            inner.events.log(LogLevel::Info, APP, &format!("Download queued with id: {download_id}"));
        }

        Ok(Prepared {
            id: download_id,
            args: plan.args,
            start_now,
            is_playlist,
            initial_item,
            log_progress: settings.debug_mode && settings.log_progress,
        })
    }

    async fn launch(&self, prepared: &Prepared) -> Result<(), String> {
        let inner = &self.inner;
        inner.events.log(LogLevel::Info, APP, &format!("Starting yt-dlp download with args: {}", prepared.args.join(" ")));
        if !prepared.log_progress {
            inner.events.log(
                LogLevel::Warning,
                APP,
                "Progress logs are hidden. Enable 'Debug Mode > Log Progress' in Settings to unhide.",
            );
        }
        let spawned = inner
            .runner
            .spawn(prepared.args.clone())
            .map_err(|e| format!("Failed to start yt-dlp: {e}"))?;
        let pid = spawned.pid;

        let intent = {
            let mut jobs = inner.jobs.lock().unwrap();
            jobs.get_mut(&prepared.id).and_then(|job| {
                job.pid = Some(pid);
                job.intent
            })
        };
        if let Err(e) = inner.repo.set_process_id(&prepared.id, Some(pid as i64)).await {
            log::warn!("Could not record the process id of {}: {e}", prepared.id);
        }
        tokio::spawn(supervise(
            inner.clone(),
            SuperviseCtx {
                id: prepared.id.clone(),
                is_playlist: prepared.is_playlist,
                log_progress: prepared.log_progress,
                initial_item: prepared.initial_item.clone(),
            },
            spawned,
        ));
        if intent.is_some() {
            // Paused or cancelled while still spawning.
            inner.runner.kill(pid);
        }
        Ok(())
    }
}

struct SuperviseCtx {
    id: String,
    is_playlist: bool,
    log_progress: bool,
    initial_item: Option<String>,
}

/// Progress bookkeeping for one running download.
struct Run {
    first_progress: bool,
    latest: Option<ProgressRow>,
    unsaved: bool,
    emit_gate: Throttle,
    persist_gate: Throttle,
}

impl Run {
    async fn on_progress<R: Runner, E: Events>(
        &mut self,
        inner: &Inner<R, E>,
        ctx: &SuperviseCtx,
        row: ProgressRow,
    ) {
        if self.first_progress {
            self.first_progress = false;
            if let Err(e) = inner.repo.set_status(&ctx.id, Status::Downloading.as_str(), None).await {
                log::warn!("Could not mark {} as downloading: {e}", ctx.id);
            }
            inner.emit_state(&ctx.id).await;
        }
        let now = Instant::now();
        if self.emit_gate.ready(now) {
            inner.events.progress(&progress_event(&ctx.id, &row));
        }
        if self.persist_gate.ready(now) {
            self.save(inner, &ctx.id, &row).await;
            self.unsaved = false;
        } else {
            self.unsaved = true;
        }
        self.latest = Some(row);
    }

    async fn save<R: Runner, E: Events>(&self, inner: &Inner<R, E>, id: &str, row: &ProgressRow) {
        if let Err(e) = inner.repo.update_progress(id, row).await {
            log::warn!("Could not save progress of {id}: {e}");
        }
    }

    async fn flush<R: Runner, E: Events>(&mut self, inner: &Inner<R, E>, id: &str) {
        if let (true, Some(row)) = (self.unsaved, self.latest.as_ref()) {
            self.save(inner, id, row).await;
            self.unsaved = false;
        }
    }
}

/// Reads a download's output until the process ends, then records the outcome.
async fn supervise<R: Runner, E: Events>(inner: Arc<Inner<R, E>>, ctx: SuperviseCtx, mut spawned: Spawned) {
    let source = format!("YT-DLP Download {}", ctx.id);
    let mut item = ctx.initial_item.clone();
    let mut completed = false;
    let mut last_error: Option<String> = None;
    let mut last_stderr: Option<String> = None;
    let mut run = Run {
        first_progress: true,
        latest: None,
        unsaved: false,
        emit_gate: Throttle::new(PROGRESS_EMIT_INTERVAL),
        persist_gate: Throttle::new(PROGRESS_PERSIST_INTERVAL),
    };

    while let Some(line) = spawned.lines.recv().await {
        let (text, from_stderr) = match line {
            OutputLine::Stdout(t) => (t, false),
            OutputLine::Stderr(t) => (t, true),
        };
        match parse_line(&text) {
            Line::Progress(update) => {
                if ctx.log_progress {
                    inner.events.log(LogLevel::Progress, &source, &text);
                }
                let row = ProgressRow {
                    status: Some(update.status),
                    item: item.clone(),
                    progress: nonzero_f64(update.progress),
                    total: nonzero_i64(update.total),
                    downloaded: nonzero_i64(update.downloaded),
                    speed: nonzero_f64(update.speed),
                    eta: nonzero_i64(update.eta),
                };
                run.on_progress(&inner, &ctx, row).await;
            }
            Line::Ffmpeg => {
                // ffmpeg reports no usable progress: show an indeterminate "finished" state.
                if ctx.log_progress {
                    inner.events.log(LogLevel::Progress, &source, &text);
                }
                let row = ProgressRow { status: Some("finished".into()), item: item.clone(), ..Default::default() };
                run.on_progress(&inner, &ctx, row).await;
            }
            Line::PlaylistItem { current, total } => {
                inner.events.log(LogLevel::Info, &source, &text);
                if ctx.is_playlist {
                    let value = format!("{current}/{total}");
                    if let Err(e) = inner.repo.update_item(&ctx.id, &value).await {
                        log::warn!("Could not save playlist item of {}: {e}", ctx.id);
                    }
                    item = Some(value.clone());
                    inner.events.progress(&ProgressEvent {
                        item: Some(value),
                        ..progress_event(&ctx.id, &run.latest.clone().unwrap_or_default())
                    });
                }
            }
            Line::FinalPath(path) => {
                let path = path.trim().trim_matches('"').to_string();
                let ext = path.rsplit('.').next().unwrap_or_default().to_string();
                if let Err(e) = inner.repo.update_file_path(&ctx.id, &path, &ext).await {
                    log::warn!("Could not save the file path of {}: {e}", ctx.id);
                }
                completed = !ctx.is_playlist || is_last_item(item.as_deref());
                inner.emit_state(&ctx.id).await;
            }
            Line::Log(text) => {
                if !text.trim().is_empty() {
                    inner.events.log(LogLevel::Info, &source, &text);
                    if from_stderr {
                        if text.contains("ERROR") {
                            last_error = Some(text.clone());
                        }
                        last_stderr = Some(text);
                    }
                }
            }
        }
    }

    let exit = spawned.exit.await.unwrap_or(ExitInfo { success: false, code: None });
    run.flush(&inner, &ctx.id).await;

    // Release the slot first so anyone observing the final status also sees the slot free.
    let intent = inner.jobs.lock().unwrap().remove(&ctx.id).and_then(|job| job.intent);
    let outcome = exit_outcome(intent, exit.success, completed);

    let code = exit.code.map_or("unknown".to_string(), |c| c.to_string());
    if exit.success {
        inner.events.log(LogLevel::Info, &source, &format!("yt-dlp exited with code {code}"));
    } else {
        inner.events.log(
            LogLevel::Error,
            &source,
            &format!("yt-dlp exited with code {code} (ignore if you manually paused or cancelled the download)"),
        );
    }

    let id = ctx.id.as_str();
    if let Err(e) = inner.repo.set_process_id(id, None).await {
        log::warn!("Could not clear the process id of {id}: {e}");
    }
    let result = match outcome {
        ExitOutcome::Completed => {
            inner.events.log(LogLevel::Info, APP, &format!("yt-dlp download completed with id: {id}"));
            inner.repo.set_status(id, Status::Completed.as_str(), None).await.map(|_| ())
        }
        ExitOutcome::Paused => inner.repo.set_status(id, Status::Paused.as_str(), None).await.map(|_| ()),
        ExitOutcome::Cancelled => inner.repo.delete_download(id).await.map(|_| ()),
        ExitOutcome::Errored => {
            let message = last_error
                .or(last_stderr)
                .unwrap_or_else(|| format!("yt-dlp exited with code {code}"));
            inner.repo.set_status(id, Status::Errored.as_str(), Some(&message)).await.map(|_| ())
        }
    };
    if let Err(e) = result {
        log::error!("Could not record the outcome of download {id}: {e}");
    }
    if outcome == ExitOutcome::Cancelled {
        inner.events.removed(id);
    } else {
        inner.emit_state(id).await;
    }
    schedule_fill(inner);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloader::repo::testing::{memory_repo, set_setting};
    use crate::downloader::repo::{DownloadRecord, VideoInfoRow};
    use serde_json::json;
    use std::collections::HashSet;
    use std::time::Duration;

    // ---------- fakes ----------

    struct FakeProc {
        lines: mpsc::Sender<OutputLine>,
        exit: Option<oneshot::Sender<ExitInfo>>,
    }

    #[derive(Default)]
    struct FakeState {
        next_pid: u32,
        procs: HashMap<u32, FakeProc>,
        /// (pid, args) of every spawn, metadata and downloads alike
        spawned: Vec<(u32, Vec<String>)>,
        metadata: HashMap<String, Value>,
        killed: Vec<u32>,
        fail_spawn: HashSet<String>,
    }

    #[derive(Clone, Default)]
    struct FakeRunner(Arc<StdMutex<FakeState>>);

    impl FakeRunner {
        fn add_metadata(&self, url: &str, json: Value) {
            self.0.lock().unwrap().metadata.insert(url.into(), json);
        }

        fn fail_spawn_for(&self, url: &str) {
            self.0.lock().unwrap().fail_spawn.insert(url.into());
        }

        /// Args of every download (non-metadata) spawn for `url`, oldest first, with their pids.
        fn download_spawns(&self, url: &str) -> Vec<(u32, Vec<String>)> {
            self.0
                .lock()
                .unwrap()
                .spawned
                .iter()
                .filter(|(_, a)| a[0] == url && !a.iter().any(|x| x == "--dump-single-json"))
                .cloned()
                .collect()
        }

        fn all_download_spawn_count(&self) -> usize {
            self.0
                .lock()
                .unwrap()
                .spawned
                .iter()
                .filter(|(_, a)| !a.iter().any(|x| x == "--dump-single-json"))
                .count()
        }

        fn killed(&self) -> Vec<u32> {
            self.0.lock().unwrap().killed.clone()
        }

        fn say(&self, pid: u32, line: &str) {
            let tx = self.0.lock().unwrap().procs[&pid].lines.clone();
            tx.try_send(OutputLine::Stdout(line.into())).unwrap();
        }

        fn say_err(&self, pid: u32, line: &str) {
            let tx = self.0.lock().unwrap().procs[&pid].lines.clone();
            tx.try_send(OutputLine::Stderr(line.into())).unwrap();
        }

        fn finish(&self, pid: u32, success: bool) {
            let mut st = self.0.lock().unwrap();
            if let Some(proc) = st.procs.get_mut(&pid) {
                if let Some(exit) = proc.exit.take() {
                    let _ = exit.send(ExitInfo { success, code: Some(if success { 0 } else { 1 }) });
                }
            }
            // Closing the lines channel is what EOF on the pipes looks like.
            st.procs.remove(&pid);
        }
    }

    impl Runner for FakeRunner {
        fn spawn(&self, args: Vec<String>) -> io::Result<Spawned> {
            let mut st = self.0.lock().unwrap();
            st.next_pid += 1;
            let pid = 1000 + st.next_pid;
            let url = args[0].clone();
            let is_metadata = args.iter().any(|a| a == "--dump-single-json");
            st.spawned.push((pid, args));

            let (lines_tx, lines_rx) = mpsc::channel(256);
            let (exit_tx, exit_rx) = oneshot::channel();

            if is_metadata {
                match st.metadata.get(&url) {
                    Some(json) => {
                        lines_tx.try_send(OutputLine::Stdout(json.to_string())).unwrap();
                        let _ = exit_tx.send(ExitInfo { success: true, code: Some(0) });
                    }
                    None => {
                        let _ = exit_tx.send(ExitInfo { success: false, code: Some(1) });
                    }
                }
                return Ok(Spawned { pid, lines: lines_rx, exit: exit_rx });
            }

            if st.fail_spawn.contains(&url) {
                st.spawned.pop();
                return Err(io::Error::new(io::ErrorKind::NotFound, "yt-dlp not found"));
            }
            st.procs.insert(pid, FakeProc { lines: lines_tx, exit: Some(exit_tx) });
            Ok(Spawned { pid, lines: lines_rx, exit: exit_rx })
        }

        fn kill(&self, pid: u32) {
            self.0.lock().unwrap().killed.push(pid);
            self.finish(pid, false);
        }
    }

    #[derive(Default)]
    struct EventLog {
        states: Vec<(String, String)>,
        progress: Vec<ProgressEvent>,
        removed: Vec<String>,
        logs: Vec<(LogLevel, String, String)>,
    }

    #[derive(Clone, Default)]
    struct FakeEvents(Arc<StdMutex<EventLog>>);

    impl FakeEvents {
        /// Statuses seen for a download, consecutive duplicates collapsed.
        fn statuses(&self, id: &str) -> Vec<String> {
            let mut out: Vec<String> = Vec::new();
            for (i, s) in &self.0.lock().unwrap().states {
                if i == id && out.last() != Some(s) {
                    out.push(s.clone());
                }
            }
            out
        }
        fn removed(&self) -> Vec<String> {
            self.0.lock().unwrap().removed.clone()
        }
        fn progress_count(&self) -> usize {
            self.0.lock().unwrap().progress.len()
        }
        fn has_log(&self, level: LogLevel, needle: &str) -> bool {
            self.0.lock().unwrap().logs.iter().any(|(l, _, m)| *l == level && m.contains(needle))
        }
    }

    impl Events for FakeEvents {
        fn state(&self, state: &DownloadState) {
            self.0
                .lock()
                .unwrap()
                .states
                .push((state.record.download_id.clone(), state.record.download_status.clone()));
        }
        fn progress(&self, event: &ProgressEvent) {
            self.0.lock().unwrap().progress.push(event.clone());
        }
        fn removed(&self, download_id: &str) {
            self.0.lock().unwrap().removed.push(download_id.into());
        }
        fn log(&self, level: LogLevel, source: &str, message: &str) {
            self.0.lock().unwrap().logs.push((level, source.into(), message.into()));
        }
    }

    struct Harness {
        manager: Manager<FakeRunner, FakeEvents>,
        repo: Repo,
        runner: FakeRunner,
        events: FakeEvents,
    }

    async fn harness(max_parallel: u32) -> Harness {
        let h = unconfigured_harness(max_parallel).await;
        h.manager.set_paths(Paths { temp_dir: "/tmp/dl".into(), download_dir: "/home/me/NeoDLP".into() });
        h
    }

    /// Like `harness`, but the download folders haven't been reported by the UI yet.
    async fn unconfigured_harness(max_parallel: u32) -> Harness {
        let repo = memory_repo().await;
        set_setting(&repo, "max_parallel_downloads", json!(max_parallel)).await;
        set_setting(&repo, "use_delay", json!(false)).await;
        set_setting(&repo, "unique_filenames", json!(false)).await;
        set_setting(&repo, "max_retries", json!(7)).await;
        set_setting(&repo, "log_progress", json!(true)).await;
        set_setting(&repo, "debug_mode", json!(true)).await;
        let runner = FakeRunner::default();
        let events = FakeEvents::default();
        let manager = Manager::new(repo.clone(), runner.clone(), events.clone(), false);
        Harness { manager, repo, runner, events }
    }

    fn video_json(id: &str, title: &str) -> Value {
        json!({
            "id": id, "webpage_url_domain": "example.com", "title": title,
            "thumbnail": "https://example.com/t.jpg", "channel": "Chan",
            "duration_string": "1:40", "duration": 100.0, "resolution": "1920x1080", "ext": "mp4",
            "vcodec": "avc1", "acodec": "mp4a", "abr": 128.0, "vbr": 2000.0, "filesize_approx": 4242
        })
    }

    fn playlist_json(first_id: &str, playlist_url: &str) -> Value {
        let mut entry = video_json(first_id, "First item");
        entry["playlist_id"] = json!("PL1");
        entry["playlist_title"] = json!("My List");
        entry["playlist_webpage_url"] = json!(playlist_url);
        entry["playlist_count"] = json!(2);
        json!({"_type": "playlist", "entries": [entry]})
    }

    fn params(url: &str) -> StartParams {
        StartParams { url: url.into(), selected_format: "137+140".into(), ..Default::default() }
    }

    const PROGRESS: &str = "status:downloading,progress: 50.0%,speed:1000.5,downloaded:500,total:1000,eta:3";

    async fn eventually<F, Fut>(what: &str, mut check: F)
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = bool>,
    {
        let result = tokio::time::timeout(Duration::from_secs(10), async {
            while !check().await {
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await;
        assert!(result.is_ok(), "timed out waiting for: {what}");
    }

    async fn wait_status(h: &Harness, id: &str, status: &str) {
        let (repo, id2, status2) = (h.repo.clone(), id.to_string(), status.to_string());
        eventually(&format!("{id} to be {status}"), move || {
            let (repo, id, status) = (repo.clone(), id2.clone(), status2.clone());
            async move {
                repo.fetch_by_id(&id).await.unwrap().is_some_and(|s| s.record.download_status == status)
            }
        })
        .await;
    }

    async fn wait_spawn(h: &Harness, url: &str, nth: usize) -> u32 {
        let (runner, url2) = (h.runner.clone(), url.to_string());
        eventually(&format!("spawn #{nth} of {url}"), move || {
            let (runner, url) = (runner.clone(), url2.clone());
            async move { runner.download_spawns(&url).len() >= nth }
        })
        .await;
        h.runner.download_spawns(url)[nth - 1].0
    }

    async fn row(h: &Harness, id: &str) -> DownloadState {
        h.repo.fetch_by_id(id).await.unwrap().unwrap_or_else(|| panic!("no row {id}"))
    }

    fn arg_pair(args: &[String], flag: &str, value: &str) -> bool {
        args.windows(2).any(|w| w[0] == flag && w[1] == value)
    }

    // ---------- single download ----------

    #[tokio::test]
    async fn downloads_a_video_end_to_end() {
        let h = harness(2).await;
        h.runner.add_metadata("https://x/v1", video_json("v1", "A title"));
        let id = h.manager.start_download(params("https://x/v1")).await.unwrap();

        let r = row(&h, &id).await;
        assert_eq!(r.record.download_status, "starting");
        assert_eq!(r.title, "A title");
        assert_eq!(r.record.video_id, "example_v1");
        assert_eq!(r.record.format_id, "137+140");
        assert_eq!(h.manager.running_count(), 1);

        let pid = wait_spawn(&h, "https://x/v1", 1).await;
        assert_eq!(row(&h, &id).await.record.process_id, Some(pid as i64));
        let args = &h.runner.download_spawns("https://x/v1")[0].1;
        assert!(arg_pair(args, "--retries", "7"), "settings reach yt-dlp: {args:?}");
        assert!(arg_pair(args, "--paths", "home:/home/me/NeoDLP"));
        assert!(!args.iter().any(|a| a == "--exec"));

        h.runner.say(pid, PROGRESS);
        wait_status(&h, &id, "downloading").await;
        h.runner.say(pid, "Finalpath: /home/me/NeoDLP/A title.mp4");
        h.runner.finish(pid, true);
        wait_status(&h, &id, "completed").await;

        let r = row(&h, &id).await;
        assert_eq!(r.record.filepath.as_deref(), Some("/home/me/NeoDLP/A title.mp4"));
        assert_eq!(r.record.ext.as_deref(), Some("mp4"));
        assert_eq!(r.record.progress, Some(50.0));
        assert_eq!(r.record.downloaded, Some(500));
        assert_eq!(r.record.total, Some(1000));
        assert_eq!(r.record.eta, Some(3));
        assert_eq!(r.record.process_id, None);
        assert!(r.record.completed_at.is_some());
        assert_eq!(r.record.resolution.as_deref(), Some("1920x1080"));
        assert_eq!(r.record.filetype.as_deref(), Some("video+audio"));
        assert_eq!(h.manager.running_count(), 0);
        assert_eq!(h.events.statuses(&id), ["starting", "downloading", "completed"]);
        assert!(h.events.progress_count() >= 1);
        assert!(h.events.has_log(LogLevel::Progress, "status:downloading"));
    }

    #[tokio::test]
    async fn non_ascii_titles_and_paths_survive() {
        let h = harness(2).await;
        let title = "日本語のタイトル 🎬 café Привет";
        h.runner.add_metadata("https://x/jp", video_json("jp1", title));
        let id = h.manager.start_download(params("https://x/jp")).await.unwrap();
        let pid = wait_spawn(&h, "https://x/jp", 1).await;
        h.runner.say(pid, "Finalpath: D:\\下载\\日本語のタイトル 🎬 café Привет.mp4");
        h.runner.finish(pid, true);
        wait_status(&h, &id, "completed").await;

        let r = row(&h, &id).await;
        assert_eq!(r.title, title);
        assert_eq!(r.record.filepath.as_deref(), Some("D:\\下载\\日本語のタイトル 🎬 café Привет.mp4"));
        assert_eq!(r.record.ext.as_deref(), Some("mp4"));
    }

    #[tokio::test]
    async fn zero_progress_values_are_stored_as_null() {
        let h = harness(2).await;
        h.runner.add_metadata("https://x/z", video_json("z1", "Z"));
        let id = h.manager.start_download(params("https://x/z")).await.unwrap();
        let pid = wait_spawn(&h, "https://x/z", 1).await;
        h.runner.say(pid, "status:downloading,progress:  0.0%,speed:0.0,downloaded:0,total:0,eta:0");
        wait_status(&h, &id, "downloading").await;
        h.runner.finish(pid, true);
        wait_status(&h, &id, "completed").await;
        let r = row(&h, &id).await.record;
        assert_eq!((r.progress, r.speed, r.downloaded, r.total, r.eta), (None, None, None, None, None));
    }

    #[tokio::test]
    async fn a_failed_download_is_errored_with_the_reason() {
        let h = harness(2).await;
        h.runner.add_metadata("https://x/e", video_json("e1", "E"));
        let id = h.manager.start_download(params("https://x/e")).await.unwrap();
        let pid = wait_spawn(&h, "https://x/e", 1).await;
        h.runner.say_err(pid, "WARNING: something minor");
        h.runner.say_err(pid, "ERROR: [example] e1: HTTP Error 403: Forbidden");
        h.runner.finish(pid, false);
        wait_status(&h, &id, "errored").await;

        let r = row(&h, &id).await.record;
        assert!(r.error_message.as_deref().unwrap().contains("403"), "{:?}", r.error_message);
        assert_eq!(h.manager.running_count(), 0);
        assert!(h.events.has_log(LogLevel::Error, "exited"));
    }

    #[tokio::test]
    async fn a_clean_exit_without_a_final_path_still_completes() {
        // e.g. yt-dlp found the file already downloaded
        let h = harness(2).await;
        h.runner.add_metadata("https://x/d", video_json("d1", "D"));
        let id = h.manager.start_download(params("https://x/d")).await.unwrap();
        let pid = wait_spawn(&h, "https://x/d", 1).await;
        h.runner.say(pid, "[download] D.mp4 has already been downloaded");
        h.runner.finish(pid, true);
        wait_status(&h, &id, "completed").await;
    }

    #[tokio::test]
    async fn metadata_failure_creates_nothing() {
        let h = harness(2).await;
        let err = h.manager.start_download(params("https://x/unknown")).await.unwrap_err();
        assert!(err.contains("metadata"), "{err}");
        assert!(h.repo.fetch_all().await.unwrap().is_empty());
        assert_eq!(h.runner.all_download_spawn_count(), 0);
        assert_eq!(h.manager.running_count(), 0);
    }

    #[tokio::test]
    async fn spawn_failure_marks_the_download_errored() {
        let h = harness(2).await;
        h.runner.add_metadata("https://x/s", video_json("s1", "S"));
        h.runner.fail_spawn_for("https://x/s");
        let err = h.manager.start_download(params("https://x/s")).await.unwrap_err();
        assert!(err.contains("yt-dlp not found"), "{err}");
        let all = h.repo.fetch_all().await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].record.download_status, "errored");
        assert_eq!(h.manager.running_count(), 0);
    }

    // ---------- queue ----------

    #[tokio::test]
    async fn downloads_beyond_the_parallel_limit_are_queued_then_started_in_order() {
        let h = harness(1).await;
        for (url, id) in [("https://x/a", "a1"), ("https://x/b", "b1"), ("https://x/c", "c1")] {
            h.runner.add_metadata(url, video_json(id, id));
        }
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let mut cfg = params("https://x/b");
        cfg.download_config.output_format = Some("mkv".into());
        let b = h.manager.start_download(cfg).await.unwrap();
        let c = h.manager.start_download(params("https://x/c")).await.unwrap();

        assert_eq!(row(&h, &a).await.record.download_status, "starting");
        let rb = row(&h, &b).await.record;
        assert_eq!((rb.download_status.as_str(), rb.queue_index), ("queued", Some(0)));
        assert!(rb.queue_config.as_deref().unwrap().contains("mkv"));
        assert_eq!(row(&h, &c).await.record.queue_index, Some(1));
        assert_eq!(h.runner.all_download_spawn_count(), 1, "only one process at a time");

        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.finish(pa, true);
        wait_status(&h, &a, "completed").await;

        // B is next and now runs with its stored options, as a resumed-from-queue start.
        let pb = wait_spawn(&h, "https://x/b", 1).await;
        let b_args = &h.runner.download_spawns("https://x/b")[0].1;
        assert!(arg_pair(b_args, "--merge-output-format", "mkv"), "{b_args:?}");
        assert!(b_args.iter().any(|x| x == "--continue"));
        wait_status(&h, &b, "starting").await;
        assert_eq!(row(&h, &c).await.record.download_status, "queued");
        assert_eq!(h.runner.download_spawns("https://x/c").len(), 0);

        h.runner.finish(pb, true);
        let pc = wait_spawn(&h, "https://x/c", 1).await;
        h.runner.finish(pc, true);
        wait_status(&h, &c, "completed").await;
        wait_status(&h, &b, "completed").await;
        assert_eq!(h.manager.running_count(), 0);
    }

    #[tokio::test]
    async fn a_queued_download_that_cannot_start_is_errored_and_the_queue_moves_on() {
        let h = harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        h.runner.add_metadata("https://x/b", video_json("b1", "b"));
        h.runner.add_metadata("https://x/c", video_json("c1", "c"));
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let b = h.manager.start_download(params("https://x/b")).await.unwrap();
        let c = h.manager.start_download(params("https://x/c")).await.unwrap();
        h.runner.fail_spawn_for("https://x/b");

        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.finish(pa, true);
        wait_status(&h, &b, "errored").await;
        let pc = wait_spawn(&h, "https://x/c", 1).await;
        h.runner.finish(pc, true);
        wait_status(&h, &c, "completed").await;
        let _ = a;
    }

    // ---------- pause / resume / cancel ----------

    #[tokio::test]
    async fn pausing_kills_the_process_and_frees_the_slot() {
        let h = harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        h.runner.add_metadata("https://x/b", video_json("b1", "b"));
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let b = h.manager.start_download(params("https://x/b")).await.unwrap();
        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.say(pa, PROGRESS);
        wait_status(&h, &a, "downloading").await;

        h.manager.pause_download(&a).await.unwrap();
        wait_status(&h, &a, "paused").await;
        assert_eq!(h.runner.killed(), [pa]);
        let r = row(&h, &a).await.record;
        assert_eq!(r.process_id, None);
        assert!(r.error_message.is_none(), "a pause is not an error");
        assert_ne!(h.events.statuses(&a).last().map(String::as_str), Some("errored"));

        // the queued download takes the freed slot
        wait_spawn(&h, "https://x/b", 1).await;
        wait_status(&h, &b, "starting").await;
    }

    #[tokio::test]
    async fn resuming_restarts_with_continue_under_the_same_id() {
        let h = harness(2).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.say(pa, PROGRESS);
        wait_status(&h, &a, "downloading").await;
        h.manager.pause_download(&a).await.unwrap();
        wait_status(&h, &a, "paused").await;
        assert!(!h.runner.download_spawns("https://x/a")[0].1.iter().any(|x| x == "--continue"));

        h.manager.resume_download(&a).await.unwrap();
        let p2 = wait_spawn(&h, "https://x/a", 2).await;
        assert_ne!(p2, pa);
        let args = &h.runner.download_spawns("https://x/a")[1].1;
        assert!(args.iter().any(|x| x == "--continue"), "{args:?}");
        wait_status(&h, &a, "starting").await;
        assert_eq!(h.repo.fetch_all().await.unwrap().len(), 1, "same row, not a new download");

        h.runner.finish(p2, true);
        wait_status(&h, &a, "completed").await;
    }

    #[tokio::test]
    async fn resuming_keeps_the_options_the_download_started_with() {
        let h = harness(2).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        let mut p = params("https://x/a");
        p.download_config.embed_metadata = Some(true);
        p.download_config.trim_stamps = Some(vec![10.0, 20.0]);
        p.download_config.sponsorblock = Some("mark".into());
        let a = h.manager.start_download(p).await.unwrap();
        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.say(pa, PROGRESS);
        wait_status(&h, &a, "downloading").await;
        h.manager.pause_download(&a).await.unwrap();
        wait_status(&h, &a, "paused").await;

        let r = row(&h, &a).await.record;
        assert_eq!((r.embed_metadata, r.trim_stamps.as_deref()), (1, Some("10,20")));
        assert_eq!(r.sponsorblock_mark.as_deref(), Some("default"));

        h.manager.resume_download(&a).await.unwrap();
        wait_spawn(&h, "https://x/a", 2).await;
        let args = &h.runner.download_spawns("https://x/a")[1].1;
        assert!(args.iter().any(|x| x == "--embed-metadata"));
        assert!(arg_pair(args, "--download-sections", "*10-20"));
        assert!(arg_pair(args, "--sponsorblock-mark", "default"));
    }

    #[tokio::test]
    async fn cancelling_a_running_download_deletes_it() {
        let h = harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        h.runner.add_metadata("https://x/b", video_json("b1", "b"));
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let _b = h.manager.start_download(params("https://x/b")).await.unwrap();
        let pa = wait_spawn(&h, "https://x/a", 1).await;

        h.manager.cancel_download(&a).await.unwrap();
        eventually("row to be deleted", || async { h.repo.fetch_by_id(&a).await.unwrap().is_none() }).await;
        assert_eq!(h.runner.killed(), [pa]);
        assert_eq!(h.events.removed(), [a.clone()]);
        wait_spawn(&h, "https://x/b", 1).await;
    }

    #[tokio::test]
    async fn cancelling_a_queued_download_needs_no_process() {
        let h = harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        h.runner.add_metadata("https://x/b", video_json("b1", "b"));
        let _a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let b = h.manager.start_download(params("https://x/b")).await.unwrap();

        h.manager.cancel_download(&b).await.unwrap();
        assert!(h.repo.fetch_by_id(&b).await.unwrap().is_none());
        assert!(h.runner.killed().is_empty());
        assert_eq!(h.events.removed(), [b]);
    }

    #[tokio::test]
    async fn a_paused_queued_download_is_not_started() {
        let h = harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        h.runner.add_metadata("https://x/b", video_json("b1", "b"));
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let b = h.manager.start_download(params("https://x/b")).await.unwrap();

        h.manager.pause_download(&b).await.unwrap();
        assert_eq!(row(&h, &b).await.record.download_status, "paused");
        assert!(h.runner.killed().is_empty());

        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.finish(pa, true);
        wait_status(&h, &a, "completed").await;
        tokio::time::sleep(Duration::from_millis(200)).await;
        assert_eq!(h.runner.download_spawns("https://x/b").len(), 0);
        assert_eq!(row(&h, &b).await.record.download_status, "paused");
    }

    // ---------- playlists ----------

    #[tokio::test]
    async fn playlist_downloads_track_the_current_item() {
        let h = harness(2).await;
        h.runner.add_metadata("https://x/pl", playlist_json("p1", "https://x/pl"));
        let mut p = params("https://x/pl");
        p.selected_format = "best".into();
        p.playlist_items = Some("1,2".into());
        let id = h.manager.start_download(p).await.unwrap();

        let r = row(&h, &id).await;
        assert_eq!(r.record.playlist_id.as_deref(), Some("example_PL1"));
        assert_eq!(r.record.playlist_indices.as_deref(), Some("1,2"));
        assert_eq!(r.playlist_title.as_deref(), Some("My List"));
        assert_eq!(r.playlist_n_entries, Some(2));

        let pid = wait_spawn(&h, "https://x/pl", 1).await;
        let args = &h.runner.download_spawns("https://x/pl")[0].1;
        assert!(arg_pair(args, "--playlist-items", "1,2"));
        assert!(!args.iter().any(|a| a == "--format"), "format 'best' is omitted for playlists");

        h.runner.say(pid, "[download] Downloading item 1 of 2");
        h.runner.say(pid, PROGRESS);
        h.runner.say(pid, "Finalpath: /home/me/NeoDLP/My List/[1]_one.mp4");
        h.runner.say(pid, "[download] Downloading item 2 of 2");
        h.runner.say(pid, "Finalpath: /home/me/NeoDLP/My List/[2]_two.mp4");
        h.runner.finish(pid, true);
        wait_status(&h, &id, "completed").await;

        let r = row(&h, &id).await.record;
        assert_eq!(r.item.as_deref(), Some("2/2"));
        assert_eq!(r.filepath.as_deref(), Some("/home/me/NeoDLP/My List/[2]_two.mp4"));
    }

    #[tokio::test]
    async fn a_queued_playlist_starts_from_its_playlist_url() {
        let h = harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        h.runner.add_metadata("https://x/pl", playlist_json("p1", "https://x/pl"));
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let mut p = params("https://x/pl");
        p.selected_format = "best".into();
        p.playlist_items = Some("1,2".into());
        let pl = h.manager.start_download(p).await.unwrap();
        assert_eq!(row(&h, &pl).await.record.download_status, "queued");

        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.finish(pa, true);
        wait_status(&h, &a, "completed").await;
        wait_spawn(&h, "https://x/pl", 1).await;
        let args = &h.runner.download_spawns("https://x/pl")[0].1;
        assert!(arg_pair(args, "--playlist-items", "1,2"), "{args:?}");
    }

    // ---------- lifecycle ----------

    async fn seed_row(h: &Harness, id: &str, status: &str, queue_index: Option<i64>) {
        h.repo
            .save_video_info(&VideoInfoRow {
                video_id: format!("example_{id}"),
                title: id.into(),
                url: format!("https://x/{id}"),
                host: "example.com".into(),
                ..Default::default()
            })
            .await
            .unwrap();
        h.repo
            .save_download(&DownloadRecord {
                download_id: id.into(),
                download_status: status.into(),
                video_id: format!("example_{id}"),
                format_id: "137+140".into(),
                queue_index,
                queue_config: queue_index.map(|_| "{}".into()),
                ..Default::default()
            })
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn recover_pauses_interrupted_downloads_and_starts_the_queue() {
        let h = harness(2).await;
        seed_row(&h, "run1", "downloading", None).await;
        seed_row(&h, "run2", "starting", None).await;
        seed_row(&h, "q1", "queued", Some(0)).await;
        h.runner.add_metadata("https://x/q1", video_json("q1", "q1"));

        h.manager.recover().await;

        assert_eq!(row(&h, "run1").await.record.download_status, "paused");
        assert_eq!(row(&h, "run2").await.record.download_status, "paused");
        wait_spawn(&h, "https://x/q1", 1).await;
        wait_status(&h, "q1", "starting").await;
        assert_eq!(h.manager.running_count(), 1);
    }

    #[tokio::test]
    async fn shutdown_pauses_running_and_queued_downloads_without_starting_more() {
        let h = harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        h.runner.add_metadata("https://x/b", video_json("b1", "b"));
        let a = h.manager.start_download(params("https://x/a")).await.unwrap();
        let b = h.manager.start_download(params("https://x/b")).await.unwrap();
        let pa = wait_spawn(&h, "https://x/a", 1).await;
        h.runner.say(pa, PROGRESS);
        wait_status(&h, &a, "downloading").await;

        h.manager.shutdown().await;
        assert_eq!(h.runner.killed(), [pa]);
        assert_eq!(row(&h, &a).await.record.download_status, "paused");
        assert_eq!(row(&h, &b).await.record.download_status, "paused");
        assert_eq!(h.manager.running_count(), 0);
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(h.runner.download_spawns("https://x/b").len(), 0, "the freed slot is not refilled");
    }

    // ---------- download folders ----------

    #[tokio::test]
    async fn queued_downloads_wait_until_the_download_folders_are_known() {
        // The app starts the queue at launch, before the webview has resolved the folders.
        let h = unconfigured_harness(1).await;
        seed_row(&h, "q1", "queued", Some(0)).await;
        h.runner.add_metadata("https://x/q1", video_json("q1", "q1"));

        h.manager.recover().await;
        tokio::time::sleep(Duration::from_millis(100)).await;
        assert_eq!(h.runner.all_download_spawn_count(), 0, "must not run with empty --paths");
        assert_eq!(row(&h, "q1").await.record.download_status, "queued");

        h.manager.set_paths(Paths { temp_dir: "/tmp/dl".into(), download_dir: "/home/me/NeoDLP".into() });
        wait_spawn(&h, "https://x/q1", 1).await;
        let args = &h.runner.download_spawns("https://x/q1")[0].1;
        assert!(arg_pair(args, "--paths", "temp:/tmp/dl"), "{args:?}");
    }

    #[tokio::test]
    async fn starting_a_download_before_the_folders_are_known_is_refused() {
        let h = unconfigured_harness(1).await;
        h.runner.add_metadata("https://x/a", video_json("a1", "a"));
        let err = h.manager.start_download(params("https://x/a")).await.unwrap_err();
        assert!(err.contains("folder"), "{err}");
        assert!(h.repo.fetch_all().await.unwrap().is_empty());
        assert_eq!(h.runner.0.lock().unwrap().spawned.len(), 0, "not even the metadata fetch");
    }

    // ---------- metadata ----------

    #[tokio::test]
    async fn fetch_video_metadata_returns_the_json_and_uses_settings() {
        let h = harness(2).await;
        set_setting(&h.repo, "prefer_video_over_playlist", json!(true)).await;
        h.runner.add_metadata("https://x/m", video_json("m1", "Meta ✨"));
        let v = h
            .manager
            .fetch_video_metadata(MetadataParams { url: "https://x/m".into(), ..Default::default() })
            .await
            .unwrap();
        assert_eq!(v["title"], "Meta ✨");
        let spawned = h.runner.0.lock().unwrap().spawned.clone();
        let args = &spawned[0].1;
        assert!(args.iter().any(|a| a == "--dump-single-json"));
        assert!(args.iter().any(|a| a == "--no-playlist"));
    }

    #[tokio::test]
    async fn fetch_video_metadata_failure_is_an_error() {
        let h = harness(2).await;
        let err = h
            .manager
            .fetch_video_metadata(MetadataParams { url: "https://x/nope".into(), ..Default::default() })
            .await
            .unwrap_err();
        assert!(!err.is_empty());
    }
}
