//! Pure construction of yt-dlp command lines. The ordering and conditions mirror the argument
//! building previously done in `src/hooks/use-downloader.ts`, so behaviour is unchanged.

use super::model::{DownloadConfig, FileType, ResumeState};
use super::settings::DownloadSettings;

#[derive(Debug, Clone, Default)]
pub struct ArgsContext {
    pub is_macos: bool,
    pub temp_dir: String,
    pub download_dir: String,
}

#[derive(Debug, Clone, Default)]
pub struct MetadataRequest {
    pub url: String,
    pub format_id: Option<String>,
    pub playlist_indices: Option<String>,
    pub selected_subtitles: Option<String>,
    pub resume_state: Option<ResumeState>,
    pub download_config: Option<DownloadConfig>,
}

#[derive(Debug, Clone, Default)]
pub struct DownloadRequest {
    pub url: String,
    pub download_id: String,
    pub selected_format: String,
    pub selected_subtitles: Option<String>,
    pub playlist_items: Option<String>,
    pub download_config: DownloadConfig,
    pub resume_state: Option<ResumeState>,
    /// Codecs of the (first) fetched video entry; used to decide the file type.
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub duration: Option<f64>,
}

/// The argument list plus every decision that gets persisted alongside the download.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct DownloadPlan {
    pub args: Vec<String>,
    pub file_type: Option<FileType>,
    pub output_format: Option<String>,
    pub embed_metadata: bool,
    pub embed_thumbnail: bool,
    pub square_crop_thumbnail: bool,
    pub trim_stamps: Option<String>,
    pub sponsorblock_remove: Option<String>,
    pub sponsorblock_mark: Option<String>,
    pub use_aria2: bool,
    pub custom_command: Option<String>,
}

const PROGRESS_TEMPLATE: &str = "status:%(progress.status)s,progress:%(progress._percent_str)s,speed:%(progress.speed)f,downloaded:%(progress.downloaded_bytes)d,total:%(progress.total_bytes)d,eta:%(progress.eta)d";
const MACOS_APP_DIR: &str = "/Applications/NeoDLP.app/Contents/MacOS";
/// The bundled yt-dlp is a PyInstaller build that ignores PYTHONUTF8 / PYTHONIOENCODING: on Windows
/// it prints cp1252 and silently drops characters outside it. Only this flag makes its output UTF-8,
/// which is what the app decodes (an old source of "invalid utf-8 sequence" errors).
const ENCODING_ARGS: &[&str] = &["--encoding", "utf-8"];
const ARIA2_ARGS: &str = "aria2c:-c -j 16 -x 16 -s 16 -k 1M --check-certificate=false";
const SQUARE_CROP_ARGS: &str = "ThumbnailsConvertor+FFmpeg_o:-c:v mjpeg -qmin 1 -qscale:v 1 -vf crop=\"'min(iw,ih)':'min(iw,ih)'\"";

fn opt(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|v| !v.is_empty())
}

fn push(args: &mut Vec<String>, items: &[&str]) {
    args.extend(items.iter().map(|s| s.to_string()));
}

fn push_macos(args: &mut Vec<String>, ctx: &ArgsContext) {
    if ctx.is_macos {
        let deno = format!("deno:{MACOS_APP_DIR}/deno");
        push(args, &["--ffmpeg-location", MACOS_APP_DIR, "--js-runtimes", &deno]);
    }
}

fn push_verbosity(args: &mut Vec<String>, s: &DownloadSettings) {
    args.push(if s.debug_mode && s.log_verbose { "--verbose" } else { "--no-warnings" }.into());
}

fn push_format(args: &mut Vec<String>, format: &str) {
    push(args, &["--format", format]);
    if format.split('+').count() > 2 {
        args.push("--audio-multistreams".into());
    }
}

fn push_subtitles(args: &mut Vec<String>, subtitles: &str) {
    if subtitles.split(',').any(|lang| lang.ends_with("-orig")) {
        args.push("--write-auto-sub".into());
    }
    push(args, &["--embed-subs", "--sub-lang", subtitles]);
}

fn push_sleep(args: &mut Vec<String>, requests: &str, min: &str, max: &str) {
    push(
        args,
        &["--sleep-requests", requests, "--sleep-interval", min, "--max-sleep-interval", max],
    );
}

fn push_custom_sleep(args: &mut Vec<String>, s: &DownloadSettings) {
    push_sleep(
        args,
        &s.request_sleep_interval.to_string(),
        &s.min_sleep_interval.to_string(),
        &s.max_sleep_interval.to_string(),
    );
}

/// Sleep preset for an auto delay across a playlist of `len` items.
fn push_auto_playlist_sleep(args: &mut Vec<String>, len: usize) {
    match len {
        0..=5 => push_sleep(args, "1", "5", "10"),
        6..=99 => push_sleep(args, "1", "10", "20"),
        100..=499 => push_sleep(args, "2", "20", "40"),
        _ => push_sleep(args, "2", "40", "60"),
    }
}

fn push_proxy(args: &mut Vec<String>, s: &DownloadSettings) {
    if s.use_proxy && !s.proxy_url.is_empty() {
        push(args, &["--proxy", &s.proxy_url]);
    }
}

fn push_ip_version(args: &mut Vec<String>, s: &DownloadSettings) {
    if s.use_force_internet_protocol {
        match s.force_internet_protocol.as_str() {
            "ipv4" => args.push("--force-ipv4".into()),
            "ipv6" => args.push("--force-ipv6".into()),
            _ => {}
        }
    }
}

fn push_cookies(args: &mut Vec<String>, s: &DownloadSettings) {
    if !s.use_cookies {
        return;
    }
    if s.import_cookies_from == "browser" && !s.cookies_browser.is_empty() {
        push(args, &["--cookies-from-browser", &s.cookies_browser]);
    } else if s.import_cookies_from == "file" && !s.cookies_file.is_empty() {
        push(args, &["--cookies", &s.cookies_file]);
    }
}

fn push_potoken(args: &mut Vec<String>, s: &DownloadSettings) {
    if !s.use_potoken {
        return;
    }
    let disable = if s.disable_innertube { ";disable_innertube=1" } else { "" };
    let value = format!(
        "youtubepot-bgutilhttp:base_url=http://localhost:{}{disable}",
        s.pot_server_port
    );
    push(args, &["--extractor-args", &value]);
}

/// A sponsorblock category setting: `custom` expands to the chosen categories (or `default`).
fn sponsorblock_value(setting: &str, categories: &[String]) -> String {
    if setting == "custom" {
        if categories.is_empty() {
            "default".into()
        } else {
            categories.join(",")
        }
    } else {
        setting.into()
    }
}

/// Custom commands, when active, replace everything the settings would otherwise derive.
fn custom_active(s: &DownloadSettings, resume: Option<&ResumeState>) -> bool {
    s.use_custom_commands || resume.is_some_and(|r| opt(&r.custom_command).is_some())
}

fn resolve_custom_command(
    s: &DownloadSettings,
    config: Option<&DownloadConfig>,
    resume: Option<&ResumeState>,
) -> Option<String> {
    let resolved = if let Some(cmd) = resume.and_then(|r| opt(&r.custom_command)) {
        Some(cmd.to_string())
    } else if s.use_custom_commands {
        let id = config.and_then(|c| opt(&c.custom_command))?;
        s.custom_commands.iter().find(|c| c.id == id).map(|c| c.args.clone())
    } else {
        None
    };
    resolved.filter(|cmd| !cmd.trim().is_empty())
}

fn split_command(cmd: &str) -> Vec<String> {
    shell_words::split(cmd)
        .unwrap_or_else(|_| cmd.split_whitespace().map(String::from).collect())
}

/// Whether this is a playlist download and which items (`--playlist-items`) it covers. A resumed
/// download remembers its own selection.
pub fn playlist_selection<'a>(
    items: Option<&'a str>,
    resume: Option<&'a ResumeState>,
) -> (bool, Option<&'a str>) {
    let resume_indices = resume.and_then(|r| opt(&r.playlist_indices));
    let resume_is_playlist =
        resume.is_some_and(|r| opt(&r.playlist_id).is_some()) && resume_indices.is_some();
    let is_playlist = items.is_some() || resume_is_playlist;
    let indices = if is_playlist { resume_indices.or(items) } else { None };
    (is_playlist, indices)
}

pub fn build_metadata_args(
    s: &DownloadSettings,
    req: &MetadataRequest,
    ctx: &ArgsContext,
) -> Vec<String> {
    let mut a = vec![req.url.clone()];
    push(&mut a, ENCODING_ARGS);
    a.push("--dump-single-json".into());
    push_verbosity(&mut a, s);

    let format = opt(&req.format_id);
    if let Some(format) = format {
        push_format(&mut a, format);
    }
    if let Some(subtitles) = opt(&req.selected_subtitles) {
        push_subtitles(&mut a, subtitles);
    }
    let indices = opt(&req.playlist_indices);
    if let Some(indices) = indices {
        push(&mut a, &["--playlist-items", indices]);
    }
    if s.prefer_video_over_playlist && indices.is_none() {
        a.push("--no-playlist".into());
    }
    if s.strict_downloadablity_check {
        a.push(if format.is_none() { "--check-all-formats" } else { "--check-formats" }.into());
    }
    push_macos(&mut a, ctx);

    let resume = req.resume_state.as_ref();
    if let Some(cmd) = resolve_custom_command(s, req.download_config.as_ref(), resume) {
        a.extend(split_command(&cmd));
    }
    if custom_active(s, resume) {
        return a;
    }

    push_proxy(&mut a, s);
    push_ip_version(&mut a, s);
    push_cookies(&mut a, s);

    let resume_remove = resume.and_then(|r| opt(&r.sponsorblock_remove));
    let resume_mark = resume.and_then(|r| opt(&r.sponsorblock_mark));
    if s.use_sponsorblock || resume_remove.is_some() || resume_mark.is_some() {
        if s.sponsorblock_mode == "remove" || resume_remove.is_some() {
            let value = resume_remove.map(String::from).unwrap_or_else(|| {
                sponsorblock_value(&s.sponsorblock_remove, &s.sponsorblock_remove_categories)
            });
            push(&mut a, &["--sponsorblock-remove", &value]);
        } else if s.sponsorblock_mode == "mark" || resume_mark.is_some() {
            let value = resume_mark.map(String::from).unwrap_or_else(|| {
                sponsorblock_value(&s.sponsorblock_mark, &s.sponsorblock_mark_categories)
            });
            push(&mut a, &["--sponsorblock-mark", &value]);
        }
    }

    if s.use_search_delay {
        match s.delay_mode.as_str() {
            "auto" => push_sleep(&mut a, "1", "10", "20"),
            "custom" => push_custom_sleep(&mut a, s),
            _ => {}
        }
    }
    push_potoken(&mut a, s);
    a
}

pub fn build_download_args(
    s: &DownloadSettings,
    req: &DownloadRequest,
    ctx: &ArgsContext,
) -> DownloadPlan {
    let resume = req.resume_state.as_ref();
    let cfg = &req.download_config;

    let (is_playlist, indices) = playlist_selection(opt(&req.playlist_items), resume);
    let is_multiple = indices.is_some_and(|i| i.contains(','));
    let multi_audio = req.selected_format.split('+').count() > 2;

    let file_type = if multi_audio {
        FileType::VideoAudio
    } else {
        FileType::from_codecs(req.vcodec.as_deref(), req.acodec.as_deref())
    };
    let mut plan = DownloadPlan { file_type: Some(file_type), ..Default::default() };

    let mut a = vec![req.url.clone()];
    push(&mut a, ENCODING_ARGS);
    push(
        &mut a,
        &[
            "--newline",
            "--progress-template",
            PROGRESS_TEMPLATE,
            "--paths",
            &format!("temp:{}", ctx.temp_dir),
            "--paths",
            &format!("home:{}", ctx.download_dir),
            // yt-dlp prints this itself, so the path is always UTF-8 (unlike `--exec echo` via cmd.exe).
            // --print implies --quiet, which would hide progress output.
            "--print",
            "after_move:Finalpath: %(filepath)s",
            "--no-quiet",
            "--no-mtime",
            "--retries",
            &s.max_retries.to_string(),
        ],
    );
    push_macos(&mut a, ctx);

    let template = &s.filename_template;
    let output = match (is_multiple, s.unique_filenames) {
        (true, true) => format!(
            "%(playlist_title|Untitled)s[{}]/[%(playlist_index|0)d]_{template}.%(ext)s",
            req.download_id
        ),
        (true, false) => format!("%(playlist_title|Untitled)s/{template}.%(ext)s"),
        (false, true) => format!("{template}[{}].%(ext)s", req.download_id),
        (false, false) => format!("{template}.%(ext)s"),
    };
    push(&mut a, &["--output", &output]);
    if s.windows_filenames {
        a.push("--windows-filenames".into());
    }
    if s.restrict_filenames {
        a.push("--restrict-filenames".into());
    }

    let skip_settings = custom_active(s, resume);

    if !skip_settings && s.use_delay && (!s.delay_playlist_only || is_multiple) {
        let playlist_len = indices.map_or(0, |i| i.split(',').count());
        match s.delay_mode.as_str() {
            "auto" if is_multiple => push_auto_playlist_sleep(&mut a, playlist_len),
            "auto" => push_sleep(&mut a, "1", "10", "20"),
            "custom" => push_custom_sleep(&mut a, s),
            _ => {}
        }
    }

    if !is_playlist || req.selected_format != "best" {
        push_format(&mut a, &req.selected_format);
    }
    push_verbosity(&mut a, s);
    if let Some(subtitles) = opt(&req.selected_subtitles) {
        push_subtitles(&mut a, subtitles);
    }
    if let Some(indices) = indices {
        push(&mut a, &["--playlist-items", indices]);
    }

    plan.custom_command = resolve_custom_command(s, Some(cfg), resume);
    if let Some(cmd) = &plan.custom_command {
        a.extend(split_command(cmd));
    }

    if skip_settings {
        a.push(if resume.is_some() { "--continue" } else { "--no-continue" }.into());
        plan.args = a;
        return plan;
    }

    // Output format / remux / recode / audio extraction
    let config_output = opt(&cfg.output_format).filter(|f| *f != "auto");
    let resume_output = resume.and_then(|r| opt(&r.output_format));
    let format = resume_output.or(config_output);
    let formats_configured = s.video_format != "auto" || s.audio_format != "auto";
    if (file_type != FileType::Unknown && formats_configured) || format.is_some() {
        let is_video = matches!(file_type, FileType::Video | FileType::VideoAudio);
        plan.output_format = if let Some(f) = format {
            Some(f.to_string())
        } else if file_type == FileType::Audio && s.audio_format != "auto" {
            Some(s.audio_format.clone())
        } else if is_video && s.video_format != "auto" {
            Some(s.video_format.clone())
        } else {
            None
        };

        let recode_or_remux = if s.always_reencode_video { "--recode-video" } else { "--remux-video" };
        let format_to_use = format.unwrap_or(&s.video_format);
        match file_type {
            FileType::VideoAudio if s.video_format != "auto" || format.is_some() => {
                let flag = if s.always_reencode_video { "--recode-video" } else { "--merge-output-format" };
                push(&mut a, &[flag, format_to_use]);
            }
            FileType::Video if s.video_format != "auto" || format.is_some() => {
                push(&mut a, &[recode_or_remux, format_to_use]);
            }
            FileType::Audio if s.audio_format != "auto" || format.is_some() => {
                let audio = format.unwrap_or(&s.audio_format);
                push(&mut a, &["--extract-audio", "--audio-format", audio, "--audio-quality", "0"]);
            }
            FileType::Unknown => match format {
                Some(f) if ["mkv", "mp4", "webm"].contains(&f) => {
                    push(&mut a, &[recode_or_remux, format_to_use]);
                }
                Some(f) if ["mp3", "m4a", "opus"].contains(&f) => {
                    push(&mut a, &["--extract-audio", "--audio-format", f, "--audio-quality", "0"]);
                }
                _ => {}
            },
            _ => {}
        }
    }

    // Metadata / thumbnail embedding. Per-download `Some(_)` choices beat the global settings.
    let is_video = matches!(file_type, FileType::Video | FileType::VideoAudio);
    let wants = |choice: Option<bool>, resumed: bool, video_setting: bool, audio_setting: bool| {
        let explicit = choice == Some(true) || resumed;
        let unset = choice.is_none();
        (is_video && (explicit || (video_setting && unset)))
            || (file_type == FileType::Audio && (explicit || (audio_setting && unset)))
            || (file_type == FileType::Unknown && explicit)
    };

    let resume_meta = resume.is_some_and(|r| r.embed_metadata);
    if wants(cfg.embed_metadata, resume_meta, s.embed_video_metadata, s.embed_audio_metadata) {
        plan.embed_metadata = true;
        a.push("--embed-metadata".into());
    }

    let resume_thumb = resume.is_some_and(|r| r.embed_thumbnail);
    if wants(cfg.embed_thumbnail, resume_thumb, s.embed_video_thumbnail, s.embed_audio_thumbnail) {
        plan.embed_thumbnail = true;
        push(&mut a, &["--embed-thumbnail", "--convert-thumbnail", "jpg"]);
        if cfg.square_crop_thumbnail == Some(true) || resume.is_some_and(|r| r.square_crop_thumbnail) {
            plan.square_crop_thumbnail = true;
            push(&mut a, &["--postprocessor-args", SQUARE_CROP_ARGS]);
        }
    }

    push_proxy(&mut a, s);
    if s.use_rate_limit && s.rate_limit != 0.0 {
        push(&mut a, &["--limit-rate", &s.rate_limit.to_string()]);
    }
    push_ip_version(&mut a, s);
    push_cookies(&mut a, s);

    // Partial download
    let resume_trim = resume.and_then(|r| opt(&r.trim_stamps));
    let duration = req.duration.filter(|d| *d != 0.0 && !d.is_nan());
    if let Some(trim) = resume_trim {
        let mut parts = trim.split(',');
        let (start, end) = (parts.next().unwrap_or(""), parts.next().unwrap_or(""));
        push(&mut a, &["--download-sections", &format!("*{start}-{end}")]);
        plan.trim_stamps = Some(trim.to_string());
    } else if let (Some(stamps), Some(duration)) = (cfg.trim_stamps.as_ref(), duration) {
        if stamps.len() >= 2 && !(stamps[0] == 0.0 && stamps[1] == duration.floor()) {
            push(&mut a, &["--download-sections", &format!("*{}-{}", stamps[0], stamps[1])]);
            plan.trim_stamps = Some(format!("{},{}", stamps[0], stamps[1]));
        }
    }

    // SponsorBlock. "auto" means "follow the global setting". A resumed download keeps the mode it
    // started with, even if the global mode has since changed.
    let choice = opt(&cfg.sponsorblock).filter(|c| *c != "auto");
    let resume_remove = resume.and_then(|r| opt(&r.sponsorblock_remove));
    let resume_mark = resume.and_then(|r| opt(&r.sponsorblock_mark));
    if s.use_sponsorblock || choice.is_some() || resume_remove.is_some() || resume_mark.is_some() {
        if choice == Some("remove")
            || resume_remove.is_some()
            || (s.sponsorblock_mode == "remove" && choice.is_none() && resume_mark.is_none())
        {
            let value = resume_remove.map(String::from).unwrap_or_else(|| {
                sponsorblock_value(&s.sponsorblock_remove, &s.sponsorblock_remove_categories)
            });
            push(&mut a, &["--sponsorblock-remove", &value]);
            plan.sponsorblock_remove = Some(value);
        } else if choice == Some("mark")
            || resume_mark.is_some()
            || (s.sponsorblock_mode == "mark" && choice.is_none())
        {
            let value = resume_mark.map(String::from).unwrap_or_else(|| {
                sponsorblock_value(&s.sponsorblock_mark, &s.sponsorblock_mark_categories)
            });
            push(&mut a, &["--sponsorblock-mark", &value]);
            plan.sponsorblock_mark = Some(value);
        }
    }

    if s.use_aria2 || resume.is_some_and(|r| r.use_aria2) {
        plan.use_aria2 = true;
        push(
            &mut a,
            &[
                "--downloader",
                "aria2c",
                "--downloader",
                "dash,m3u8:native",
                "--downloader-args",
                ARIA2_ARGS,
            ],
        );
    }
    push_potoken(&mut a, s);

    a.push(if resume.is_some() || s.use_aria2 { "--continue" } else { "--no-continue" }.into());
    plan.args = a;
    plan
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::downloader::settings::CustomCommand;

    const TEMPLATE: &str = "status:%(progress.status)s,progress:%(progress._percent_str)s,speed:%(progress.speed)f,downloaded:%(progress.downloaded_bytes)d,total:%(progress.total_bytes)d,eta:%(progress.eta)d";

    fn plain() -> DownloadSettings {
        DownloadSettings {
            max_retries: 3,
            prefer_video_over_playlist: false,
            use_delay: false,
            windows_filenames: false,
            restrict_filenames: false,
            unique_filenames: false,
            log_verbose: false,
            filename_template: "%(title)s".into(),
            ..Default::default()
        }
    }

    fn ctx() -> ArgsContext {
        ArgsContext {
            is_macos: false,
            temp_dir: "/tmp/dl".into(),
            download_dir: "/home/me/NeoDLP".into(),
        }
    }

    fn dl() -> DownloadRequest {
        DownloadRequest {
            url: "https://example.com/v".into(),
            download_id: "ID1".into(),
            selected_format: "137+140".into(),
            vcodec: Some("avc1".into()),
            acodec: Some("mp4a".into()),
            duration: Some(100.0),
            ..Default::default()
        }
    }

    fn meta() -> MetadataRequest {
        MetadataRequest {
            url: "https://example.com/v".into(),
            ..Default::default()
        }
    }

    fn args(s: &DownloadSettings, r: &DownloadRequest) -> Vec<String> {
        build_download_args(s, r, &ctx()).args
    }

    fn margs(s: &DownloadSettings, r: &MetadataRequest) -> Vec<String> {
        build_metadata_args(s, r, &ctx())
    }

    fn has(args: &[String], seq: &[&str]) -> bool {
        args.windows(seq.len())
            .any(|w| w.iter().zip(seq).all(|(a, b)| a == b))
    }

    fn arg_pair(args: &[String], flag: &str, value: &str) -> bool {
        args.windows(2).any(|w| w[0] == flag && w[1] == value)
    }

    fn has_flag(args: &[String], flag: &str) -> bool {
        args.iter().any(|a| a == flag)
    }

    fn pos(args: &[String], flag: &str) -> usize {
        args.iter().position(|a| a == flag).unwrap_or_else(|| panic!("{flag} missing in {args:?}"))
    }

    fn strs(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    // ---------- metadata ----------

    #[test]
    fn metadata_minimal() {
        assert_eq!(
            margs(&plain(), &meta()),
            strs(&["https://example.com/v", "--encoding", "utf-8", "--dump-single-json", "--no-warnings"])
        );
    }

    #[test]
    fn metadata_verbose_needs_debug_and_log_verbose() {
        let mut s = plain();
        s.debug_mode = true;
        s.log_verbose = true;
        let a = margs(&s, &meta());
        assert!(has_flag(&a, "--verbose") && !has_flag(&a, "--no-warnings"));
        s.log_verbose = false;
        assert!(has_flag(&margs(&s, &meta()), "--no-warnings"));
    }

    #[test]
    fn metadata_format_and_multi_audio() {
        let mut r = meta();
        r.format_id = Some("137+140".into());
        let a = margs(&plain(), &r);
        assert!(has(&a, &["--format", "137+140"]) && !has_flag(&a, "--audio-multistreams"));
        r.format_id = Some("137+140+141".into());
        assert!(has_flag(&margs(&plain(), &r), "--audio-multistreams"));
    }

    #[test]
    fn metadata_subtitles_auto_sub_only_for_orig() {
        let mut r = meta();
        r.selected_subtitles = Some("en,fr".into());
        let a = margs(&plain(), &r);
        assert!(has(&a, &["--embed-subs", "--sub-lang", "en,fr"]) && !has_flag(&a, "--write-auto-sub"));
        r.selected_subtitles = Some("en,en-orig".into());
        let a = margs(&plain(), &r);
        assert!(pos(&a, "--write-auto-sub") < pos(&a, "--embed-subs"));
    }

    #[test]
    fn metadata_playlist_flags() {
        let mut s = plain();
        s.prefer_video_over_playlist = true;
        assert!(has_flag(&margs(&s, &meta()), "--no-playlist"));
        let mut r = meta();
        r.playlist_indices = Some("1,2,3".into());
        let a = margs(&s, &r);
        assert!(has(&a, &["--playlist-items", "1,2,3"]) && !has_flag(&a, "--no-playlist"));
    }

    #[test]
    fn metadata_strict_check() {
        let mut s = plain();
        s.strict_downloadablity_check = true;
        assert!(has_flag(&margs(&s, &meta()), "--check-all-formats"));
        let mut r = meta();
        r.format_id = Some("18".into());
        let a = margs(&s, &r);
        assert!(has_flag(&a, "--check-formats") && !has_flag(&a, "--check-all-formats"));
    }

    #[test]
    fn metadata_macos_flags() {
        let mut c = ctx();
        c.is_macos = true;
        let a = build_metadata_args(&plain(), &meta(), &c);
        assert!(has(
            &a,
            &[
                "--ffmpeg-location",
                "/Applications/NeoDLP.app/Contents/MacOS",
                "--js-runtimes",
                "deno:/Applications/NeoDLP.app/Contents/MacOS/deno"
            ]
        ));
    }

    #[test]
    fn metadata_network_and_cookie_settings() {
        let mut s = plain();
        s.use_proxy = true;
        s.proxy_url = "http://p:1".into();
        s.use_force_internet_protocol = true;
        s.force_internet_protocol = "ipv6".into();
        s.use_cookies = true;
        s.import_cookies_from = "file".into();
        s.cookies_file = "C:\\c.txt".into();
        let a = margs(&s, &meta());
        assert!(has(&a, &["--proxy", "http://p:1"]));
        assert!(has_flag(&a, "--force-ipv6"));
        assert!(has(&a, &["--cookies", "C:\\c.txt"]));
        s.import_cookies_from = "browser".into();
        s.cookies_browser = "firefox".into();
        assert!(has(&margs(&s, &meta()), &["--cookies-from-browser", "firefox"]));
    }

    #[test]
    fn metadata_search_delay() {
        let mut s = plain();
        s.use_search_delay = true;
        assert!(has(
            &margs(&s, &meta()),
            &["--sleep-requests", "1", "--sleep-interval", "10", "--max-sleep-interval", "20"]
        ));
        s.delay_mode = "custom".into();
        s.request_sleep_interval = 2.0;
        s.min_sleep_interval = 3.0;
        s.max_sleep_interval = 7.0;
        assert!(has(
            &margs(&s, &meta()),
            &["--sleep-requests", "2", "--sleep-interval", "3", "--max-sleep-interval", "7"]
        ));
    }

    #[test]
    fn metadata_potoken() {
        let mut s = plain();
        s.use_potoken = true;
        s.pot_server_port = 4416;
        assert!(has(
            &margs(&s, &meta()),
            &["--extractor-args", "youtubepot-bgutilhttp:base_url=http://localhost:4416"]
        ));
        s.disable_innertube = true;
        assert!(has(
            &margs(&s, &meta()),
            &["--extractor-args", "youtubepot-bgutilhttp:base_url=http://localhost:4416;disable_innertube=1"]
        ));
    }

    #[test]
    fn metadata_sponsorblock_uses_settings_mode_or_resume() {
        let mut s = plain();
        s.use_sponsorblock = true;
        s.sponsorblock_mode = "remove".into();
        s.sponsorblock_remove = "sponsor,intro".into();
        assert!(has(&margs(&s, &meta()), &["--sponsorblock-remove", "sponsor,intro"]));
        s.sponsorblock_mode = "mark".into();
        s.sponsorblock_mark = "custom".into();
        s.sponsorblock_mark_categories = vec!["outro".into(), "preview".into()];
        assert!(has(&margs(&s, &meta()), &["--sponsorblock-mark", "outro,preview"]));
        s.sponsorblock_mark_categories.clear();
        assert!(has(&margs(&s, &meta()), &["--sponsorblock-mark", "default"]));
    }

    #[test]
    fn metadata_custom_command_from_resume_suppresses_settings() {
        let mut s = plain();
        s.use_proxy = true;
        s.proxy_url = "http://p:1".into();
        let mut r = meta();
        r.resume_state = Some(ResumeState {
            custom_command: Some("--user-agent \"My Agent\" --geo-bypass".into()),
            ..Default::default()
        });
        let a = margs(&s, &r);
        assert!(has(&a, &["--user-agent", "My Agent", "--geo-bypass"]));
        assert!(!has_flag(&a, "--proxy"));
    }

    // ---------- download: base ----------

    #[test]
    fn download_base_golden() {
        let plan = build_download_args(&plain(), &dl(), &ctx());
        assert_eq!(
            plan.args,
            strs(&[
                "https://example.com/v",
                "--encoding",
                "utf-8",
                "--newline",
                "--progress-template",
                TEMPLATE,
                "--paths",
                "temp:/tmp/dl",
                "--paths",
                "home:/home/me/NeoDLP",
                "--print",
                "after_move:Finalpath: %(filepath)s",
                "--no-quiet",
                "--no-mtime",
                "--retries",
                "3",
                "--output",
                "%(title)s.%(ext)s",
                "--format",
                "137+140",
                "--no-warnings",
                "--no-continue",
            ])
        );
        assert_eq!(plan.file_type, Some(FileType::VideoAudio));
        assert!(!plan.embed_metadata && !plan.embed_thumbnail && !plan.use_aria2);
        assert_eq!(plan.output_format, None);
    }

    /// Without `--encoding utf-8`, the bundled (PyInstaller) yt-dlp prints cp1252 on Windows and drops
    /// characters it can't represent, whatever PYTHONUTF8 / PYTHONIOENCODING say. That produced the
    /// "invalid utf-8 sequence" errors for non-ASCII titles.
    #[test]
    fn every_invocation_forces_utf8_output() {
        assert!(arg_pair(&margs(&plain(), &meta()), "--encoding", "utf-8"));
        assert!(arg_pair(&args(&plain(), &dl()), "--encoding", "utf-8"));
    }

    #[test]
    fn utf8_output_is_forced_even_with_custom_commands() {
        let mut r = dl();
        r.resume_state = Some(ResumeState {
            custom_command: Some("--geo-bypass".into()),
            ..Default::default()
        });
        assert!(arg_pair(&args(&plain(), &r), "--encoding", "utf-8"));
    }

    #[test]
    fn download_never_uses_shell_exec() {
        let a = args(&plain(), &dl());
        assert!(!has_flag(&a, "--exec"));
    }

    #[test]
    fn download_macos_flags() {
        let mut c = ctx();
        c.is_macos = true;
        let a = build_download_args(&plain(), &dl(), &c).args;
        assert!(has_flag(&a, "--js-runtimes"));
    }

    // ---------- download: output templates ----------

    #[test]
    fn output_templates() {
        let mut s = plain();
        assert!(has(&args(&s, &dl()), &["--output", "%(title)s.%(ext)s"]));
        s.unique_filenames = true;
        assert!(has(&args(&s, &dl()), &["--output", "%(title)s[ID1].%(ext)s"]));

        let mut r = dl();
        r.playlist_items = Some("1,2,3".into());
        r.selected_format = "best".into();
        assert!(has(
            &args(&s, &r),
            &["--output", "%(playlist_title|Untitled)s[ID1]/[%(playlist_index|0)d]_%(title)s.%(ext)s"]
        ));
        s.unique_filenames = false;
        assert!(has(
            &args(&s, &r),
            &["--output", "%(playlist_title|Untitled)s/%(title)s.%(ext)s"]
        ));
    }

    #[test]
    fn single_playlist_item_is_not_treated_as_multiple() {
        let mut r = dl();
        r.playlist_items = Some("4".into());
        let a = args(&plain(), &r);
        assert!(has(&a, &["--output", "%(title)s.%(ext)s"]));
        assert!(has(&a, &["--playlist-items", "4"]));
    }

    #[test]
    fn filename_flags() {
        let mut s = plain();
        s.windows_filenames = true;
        s.restrict_filenames = true;
        let a = args(&s, &dl());
        assert!(has_flag(&a, "--windows-filenames") && has_flag(&a, "--restrict-filenames"));
    }

    // ---------- download: delay ----------

    fn delay_args(len: usize, playlist_only: bool, mode: &str) -> Vec<String> {
        let mut s = plain();
        s.use_delay = true;
        s.delay_playlist_only = playlist_only;
        s.delay_mode = mode.into();
        let mut r = dl();
        r.selected_format = "best".into();
        r.playlist_items = Some(
            (1..=len).map(|i| i.to_string()).collect::<Vec<_>>().join(","),
        );
        args(&s, &r)
    }

    #[test]
    fn auto_delay_presets_by_playlist_size() {
        let cases: [(usize, [&str; 3]); 6] = [
            (2, ["1", "5", "10"]),
            (5, ["1", "5", "10"]),
            (6, ["1", "10", "20"]),
            (99, ["1", "10", "20"]),
            (100, ["2", "20", "40"]),
            (500, ["2", "40", "60"]),
        ];
        for (len, [req, min, max]) in cases {
            let a = delay_args(len, true, "auto");
            assert!(
                has(&a, &["--sleep-requests", req, "--sleep-interval", min, "--max-sleep-interval", max]),
                "len {len}: {a:?}"
            );
        }
        let a = delay_args(499, true, "auto");
        assert!(has(&a, &["--sleep-requests", "2", "--sleep-interval", "20"]));
    }

    #[test]
    fn delay_playlist_only_skips_single_items() {
        let mut s = plain();
        s.use_delay = true;
        s.delay_playlist_only = true;
        assert!(!has_flag(&args(&s, &dl()), "--sleep-requests"));
        s.delay_playlist_only = false;
        assert!(has(
            &args(&s, &dl()),
            &["--sleep-requests", "1", "--sleep-interval", "10", "--max-sleep-interval", "20"]
        ));
    }

    #[test]
    fn custom_delay_uses_settings() {
        let mut s = plain();
        s.use_delay = true;
        s.delay_playlist_only = false;
        s.delay_mode = "custom".into();
        s.request_sleep_interval = 2.0;
        s.min_sleep_interval = 4.0;
        s.max_sleep_interval = 9.0;
        assert!(has(
            &args(&s, &dl()),
            &["--sleep-requests", "2", "--sleep-interval", "4", "--max-sleep-interval", "9"]
        ));
    }

    // ---------- download: format selection ----------

    #[test]
    fn playlist_with_best_omits_format() {
        let mut r = dl();
        r.selected_format = "best".into();
        r.playlist_items = Some("1,2".into());
        assert!(!has_flag(&args(&plain(), &r), "--format"));
        r.selected_format = "18".into();
        assert!(has(&args(&plain(), &r), &["--format", "18"]));
    }

    #[test]
    fn playlist_from_resume_state() {
        let mut r = dl();
        r.selected_format = "best".into();
        r.resume_state = Some(ResumeState {
            playlist_id: Some("yt_PL1".into()),
            playlist_indices: Some("2,3".into()),
            ..Default::default()
        });
        let a = args(&plain(), &r);
        assert!(has(&a, &["--playlist-items", "2,3"]) && !has_flag(&a, "--format"));
    }

    #[test]
    fn multiple_audio_streams_force_video_audio() {
        let mut r = dl();
        r.selected_format = "137+140+141".into();
        r.vcodec = None;
        r.acodec = None;
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(has_flag(&plan.args, "--audio-multistreams"));
        assert_eq!(plan.file_type, Some(FileType::VideoAudio));
    }

    #[test]
    fn subtitles_and_verbose() {
        let mut s = plain();
        s.debug_mode = true;
        s.log_verbose = true;
        let mut r = dl();
        r.selected_subtitles = Some("en-orig".into());
        let a = args(&s, &r);
        assert!(has_flag(&a, "--verbose"));
        assert!(has(&a, &["--write-auto-sub", "--embed-subs", "--sub-lang", "en-orig"]));
    }

    // ---------- download: output format ----------

    #[test]
    fn video_audio_merge_or_recode() {
        let mut s = plain();
        s.video_format = "mkv".into();
        let plan = build_download_args(&s, &dl(), &ctx());
        assert!(has(&plan.args, &["--merge-output-format", "mkv"]));
        assert_eq!(plan.output_format.as_deref(), Some("mkv"));
        s.always_reencode_video = true;
        assert!(has(&args(&s, &dl()), &["--recode-video", "mkv"]));
    }

    #[test]
    fn video_only_remux_or_recode() {
        let mut s = plain();
        s.video_format = "mp4".into();
        let mut r = dl();
        r.acodec = Some("none".into());
        assert!(has(&args(&s, &r), &["--remux-video", "mp4"]));
        s.always_reencode_video = true;
        assert!(has(&args(&s, &r), &["--recode-video", "mp4"]));
    }

    #[test]
    fn audio_only_extracts() {
        let mut s = plain();
        s.audio_format = "mp3".into();
        let mut r = dl();
        r.vcodec = Some("none".into());
        let plan = build_download_args(&s, &r, &ctx());
        assert!(has(
            &plan.args,
            &["--extract-audio", "--audio-format", "mp3", "--audio-quality", "0"]
        ));
        assert_eq!(plan.output_format.as_deref(), Some("mp3"));
    }

    #[test]
    fn config_output_format_overrides_and_auto_is_ignored() {
        let mut r = dl();
        r.download_config.output_format = Some("webm".into());
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(has(&plan.args, &["--merge-output-format", "webm"]));
        assert_eq!(plan.output_format.as_deref(), Some("webm"));
        r.download_config.output_format = Some("auto".into());
        assert!(!has_flag(&args(&plain(), &r), "--merge-output-format"));
    }

    #[test]
    fn resume_output_format_wins() {
        let mut r = dl();
        r.download_config.output_format = Some("webm".into());
        r.resume_state = Some(ResumeState {
            output_format: Some("mkv".into()),
            ..Default::default()
        });
        assert!(has(&args(&plain(), &r), &["--merge-output-format", "mkv"]));
    }

    #[test]
    fn unknown_file_type_uses_format_family() {
        let mut r = dl();
        r.vcodec = None;
        r.acodec = None;
        r.download_config.output_format = Some("mp4".into());
        assert!(has(&args(&plain(), &r), &["--remux-video", "mp4"]));
        r.download_config.output_format = Some("opus".into());
        assert!(has(&args(&plain(), &r), &["--audio-format", "opus"]));
        r.download_config.output_format = Some("gif".into());
        let a = args(&plain(), &r);
        assert!(!has_flag(&a, "--remux-video") && !has_flag(&a, "--extract-audio"));
    }

    // ---------- download: embedding ----------

    #[test]
    fn embed_metadata_rules() {
        let mut s = plain();
        // nothing enabled
        assert!(!build_download_args(&s, &dl(), &ctx()).embed_metadata);
        // global video setting applies only when the per-download choice is unset (None)
        s.embed_video_metadata = true;
        assert!(build_download_args(&s, &dl(), &ctx()).embed_metadata);
        let mut r = dl();
        r.download_config.embed_metadata = Some(false);
        assert!(!build_download_args(&s, &r, &ctx()).embed_metadata);
        // explicit per-download opt-in
        s.embed_video_metadata = false;
        r.download_config.embed_metadata = Some(true);
        let plan = build_download_args(&s, &r, &ctx());
        assert!(plan.embed_metadata && has_flag(&plan.args, "--embed-metadata"));
        // audio uses the audio setting
        let mut s2 = plain();
        s2.embed_audio_metadata = true;
        let mut ra = dl();
        ra.vcodec = Some("none".into());
        assert!(build_download_args(&s2, &ra, &ctx()).embed_metadata);
        assert!(!build_download_args(&s2, &dl(), &ctx()).embed_metadata);
        // unknown types need an explicit opt-in
        let mut ru = dl();
        ru.vcodec = None;
        ru.acodec = None;
        assert!(!build_download_args(&s, &ru, &ctx()).embed_metadata);
        ru.resume_state = Some(ResumeState { embed_metadata: true, ..Default::default() });
        assert!(build_download_args(&s, &ru, &ctx()).embed_metadata);
    }

    #[test]
    fn embed_thumbnail_and_square_crop() {
        let mut r = dl();
        r.download_config.embed_thumbnail = Some(true);
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(plan.embed_thumbnail);
        assert!(has(&plan.args, &["--embed-thumbnail", "--convert-thumbnail", "jpg"]));
        assert!(!plan.square_crop_thumbnail && !has_flag(&plan.args, "--postprocessor-args"));

        r.download_config.square_crop_thumbnail = Some(true);
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(plan.square_crop_thumbnail);
        assert!(has(
            &plan.args,
            &[
                "--postprocessor-args",
                "ThumbnailsConvertor+FFmpeg_o:-c:v mjpeg -qmin 1 -qscale:v 1 -vf crop=\"'min(iw,ih)':'min(iw,ih)'\""
            ]
        ));
    }

    #[test]
    fn square_crop_is_ignored_without_embedding() {
        let mut r = dl();
        r.download_config.square_crop_thumbnail = Some(true);
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(!plan.square_crop_thumbnail && !plan.embed_thumbnail);
    }

    // ---------- download: network / auth ----------

    #[test]
    fn proxy_rate_limit_ip_cookies() {
        let mut s = plain();
        s.use_proxy = true;
        s.proxy_url = "socks5://h:1".into();
        s.use_rate_limit = true;
        s.rate_limit = 1048576.0;
        s.use_force_internet_protocol = true;
        s.force_internet_protocol = "ipv4".into();
        s.use_cookies = true;
        s.cookies_browser = "chrome".into();
        let a = args(&s, &dl());
        assert!(has(&a, &["--proxy", "socks5://h:1"]));
        assert!(has(&a, &["--limit-rate", "1048576"]));
        assert!(has_flag(&a, "--force-ipv4"));
        assert!(has(&a, &["--cookies-from-browser", "chrome"]));
    }

    #[test]
    fn empty_proxy_and_rate_limit_are_skipped() {
        let mut s = plain();
        s.use_proxy = true;
        s.use_rate_limit = true;
        s.rate_limit = 0.0;
        let a = args(&s, &dl());
        assert!(!has_flag(&a, "--proxy") && !has_flag(&a, "--limit-rate"));
    }

    // ---------- download: trim ----------

    #[test]
    fn trim_from_config() {
        let mut r = dl();
        r.download_config.trim_stamps = Some(vec![10.0, 55.5]);
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(has(&plan.args, &["--download-sections", "*10-55.5"]));
        assert_eq!(plan.trim_stamps.as_deref(), Some("10,55.5"));
    }

    #[test]
    fn trim_covering_whole_video_is_ignored() {
        let mut r = dl();
        r.duration = Some(100.7);
        r.download_config.trim_stamps = Some(vec![0.0, 100.0]);
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(!has_flag(&plan.args, "--download-sections"));
        assert_eq!(plan.trim_stamps, None);
    }

    #[test]
    fn trim_needs_known_duration_but_resume_does_not() {
        let mut r = dl();
        r.duration = None;
        r.download_config.trim_stamps = Some(vec![5.0, 9.0]);
        assert!(!has_flag(&args(&plain(), &r), "--download-sections"));
        r.resume_state = Some(ResumeState {
            trim_stamps: Some("5,9".into()),
            ..Default::default()
        });
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(has(&plan.args, &["--download-sections", "*5-9"]));
        assert_eq!(plan.trim_stamps.as_deref(), Some("5,9"));
    }

    // ---------- download: sponsorblock ----------

    #[test]
    fn sponsorblock_from_settings() {
        let mut s = plain();
        s.use_sponsorblock = true;
        s.sponsorblock_mode = "remove".into();
        s.sponsorblock_remove = "custom".into();
        s.sponsorblock_remove_categories = vec!["sponsor".into(), "selfpromo".into()];
        let plan = build_download_args(&s, &dl(), &ctx());
        assert!(has(&plan.args, &["--sponsorblock-remove", "sponsor,selfpromo"]));
        assert_eq!(plan.sponsorblock_remove.as_deref(), Some("sponsor,selfpromo"));
        assert_eq!(plan.sponsorblock_mark, None);

        s.sponsorblock_mode = "mark".into();
        s.sponsorblock_mark = "all".into();
        let plan = build_download_args(&s, &dl(), &ctx());
        assert!(has(&plan.args, &["--sponsorblock-mark", "all"]));
        assert_eq!(plan.sponsorblock_mark.as_deref(), Some("all"));
    }

    #[test]
    fn sponsorblock_per_download_choice_beats_setting() {
        let mut s = plain();
        s.use_sponsorblock = true;
        s.sponsorblock_mode = "remove".into();
        let mut r = dl();
        r.download_config.sponsorblock = Some("mark".into());
        let a = args(&s, &r);
        assert!(has(&a, &["--sponsorblock-mark", "default"]) && !has_flag(&a, "--sponsorblock-remove"));
    }

    #[test]
    fn sponsorblock_per_download_without_global_setting() {
        let mut r = dl();
        r.download_config.sponsorblock = Some("remove".into());
        assert!(has(&args(&plain(), &r), &["--sponsorblock-remove", "default"]));
        r.download_config.sponsorblock = Some("auto".into());
        assert!(!has_flag(&args(&plain(), &r), "--sponsorblock-remove"));
    }

    #[test]
    fn sponsorblock_resume_values_win() {
        let mut r = dl();
        r.resume_state = Some(ResumeState {
            sponsorblock_mark: Some("intro".into()),
            ..Default::default()
        });
        let plan = build_download_args(&plain(), &r, &ctx());
        assert!(has(&plan.args, &["--sponsorblock-mark", "intro"]));
    }

    // ---------- download: aria2 / pot / continue ----------

    #[test]
    fn aria2_args_and_flag() {
        let mut s = plain();
        s.use_aria2 = true;
        let plan = build_download_args(&s, &dl(), &ctx());
        assert!(plan.use_aria2);
        assert!(has(
            &plan.args,
            &[
                "--downloader",
                "aria2c",
                "--downloader",
                "dash,m3u8:native",
                "--downloader-args",
                "aria2c:-c -j 16 -x 16 -s 16 -k 1M --check-certificate=false"
            ]
        ));
        assert!(has_flag(&plan.args, "--continue") && !has_flag(&plan.args, "--no-continue"));
    }

    #[test]
    fn aria2_from_resume_state() {
        let mut r = dl();
        r.resume_state = Some(ResumeState { use_aria2: true, ..Default::default() });
        assert!(build_download_args(&plain(), &r, &ctx()).use_aria2);
    }

    #[test]
    fn potoken_args() {
        let mut s = plain();
        s.use_potoken = true;
        s.pot_server_port = 5000;
        assert!(has(
            &args(&s, &dl()),
            &["--extractor-args", "youtubepot-bgutilhttp:base_url=http://localhost:5000"]
        ));
    }

    #[test]
    fn continue_flag_follows_resume() {
        assert!(has_flag(&args(&plain(), &dl()), "--no-continue"));
        let mut r = dl();
        r.resume_state = Some(ResumeState::default());
        assert!(has_flag(&args(&plain(), &r), "--continue"));
    }

    // ---------- custom commands ----------

    fn custom_settings() -> DownloadSettings {
        let mut s = plain();
        s.use_custom_commands = true;
        s.custom_commands = vec![CustomCommand {
            id: "c1".into(),
            label: "mine".into(),
            args: "--limit-rate 50K --user-agent 'Fancy UA'".into(),
        }];
        s.use_proxy = true;
        s.proxy_url = "http://p:1".into();
        s.use_aria2 = true;
        s.embed_video_metadata = true;
        s
    }

    #[test]
    fn custom_command_replaces_derived_options() {
        let mut r = dl();
        r.download_config.custom_command = Some("c1".into());
        let plan = build_download_args(&custom_settings(), &r, &ctx());
        let a = &plan.args;
        assert!(has(a, &["--limit-rate", "50K", "--user-agent", "Fancy UA"]));
        assert!(!has_flag(a, "--proxy") && !has_flag(a, "--downloader") && !has_flag(a, "--embed-metadata"));
        assert!(has_flag(a, "--no-continue"));
        assert_eq!(
            plan.custom_command.as_deref(),
            Some("--limit-rate 50K --user-agent 'Fancy UA'")
        );
        assert!(!plan.use_aria2 && !plan.embed_metadata);
    }

    #[test]
    fn custom_command_setting_without_selection_still_disables_derived_options() {
        let plan = build_download_args(&custom_settings(), &dl(), &ctx());
        assert!(!has_flag(&plan.args, "--proxy"));
        assert_eq!(plan.custom_command, None);
    }

    #[test]
    fn unknown_custom_command_id_adds_nothing() {
        let mut r = dl();
        r.download_config.custom_command = Some("nope".into());
        assert_eq!(build_download_args(&custom_settings(), &r, &ctx()).custom_command, None);
    }

    #[test]
    fn resume_custom_command_is_used_verbatim() {
        let mut s = plain();
        s.use_proxy = true;
        s.proxy_url = "http://p:1".into();
        let mut r = dl();
        r.resume_state = Some(ResumeState {
            custom_command: Some("--geo-bypass".into()),
            ..Default::default()
        });
        let plan = build_download_args(&s, &r, &ctx());
        assert!(has_flag(&plan.args, "--geo-bypass") && !has_flag(&plan.args, "--proxy"));
        assert_eq!(plan.custom_command.as_deref(), Some("--geo-bypass"));
        assert!(has_flag(&plan.args, "--continue"));
    }

    #[test]
    fn custom_command_with_unbalanced_quote_falls_back_to_whitespace_split() {
        let mut r = dl();
        r.resume_state = Some(ResumeState {
            custom_command: Some("--foo \"bar baz".into()),
            ..Default::default()
        });
        assert!(has(&args(&plain(), &r), &["--foo", "\"bar", "baz"]));
    }

    #[test]
    fn non_ascii_values_pass_through_untouched() {
        let mut s = plain();
        s.filename_template = "%(title)s_日本語".into();
        let mut c = ctx();
        c.download_dir = "D:\\下载\\Привет".into();
        let a = build_download_args(&s, &dl(), &c).args;
        assert!(has(&a, &["--paths", "home:D:\\下载\\Привет"]));
        assert!(has(&a, &["--output", "%(title)s_日本語.%(ext)s"]));
    }
}
