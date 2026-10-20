//! SQLite access for downloads, ported from `src/services/database.ts`.
//!
//! The schema is owned by `migrations.rs` and applied by `tauri-plugin-sql` at startup, so this module
//! only reads and writes. Row/field names match the existing TS `DownloadState` type exactly.

use super::settings::DownloadSettings;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, sqlx::FromRow)]
pub struct VideoInfoRow {
    pub video_id: String,
    pub title: String,
    pub url: String,
    pub host: String,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
    pub duration_string: Option<String>,
    pub release_date: Option<String>,
    pub view_count: Option<i64>,
    pub like_count: Option<i64>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlaylistInfoRow {
    pub playlist_id: String,
    pub playlist_title: String,
    pub playlist_url: String,
    pub playlist_n_entries: i64,
    pub playlist_channel: Option<String>,
}

/// The columns of the `downloads` table that the app writes.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(default)]
pub struct DownloadRecord {
    pub download_id: String,
    pub download_status: String,
    pub video_id: String,
    pub format_id: String,
    pub subtitle_id: Option<String>,
    pub queue_index: Option<i64>,
    pub playlist_id: Option<String>,
    pub playlist_indices: Option<String>,
    pub process_id: Option<i64>,
    pub resolution: Option<String>,
    pub ext: Option<String>,
    pub abr: Option<f64>,
    pub vbr: Option<f64>,
    pub acodec: Option<String>,
    pub vcodec: Option<String>,
    pub dynamic_range: Option<String>,
    pub status: Option<String>,
    pub item: Option<String>,
    pub progress: Option<f64>,
    pub total: Option<i64>,
    pub downloaded: Option<i64>,
    pub speed: Option<f64>,
    pub eta: Option<i64>,
    pub filepath: Option<String>,
    pub filetype: Option<String>,
    pub filesize: Option<i64>,
    pub output_format: Option<String>,
    pub embed_metadata: i64,
    pub embed_thumbnail: i64,
    pub square_crop_thumbnail: i64,
    pub sponsorblock_remove: Option<String>,
    pub sponsorblock_mark: Option<String>,
    pub use_aria2: i64,
    pub custom_command: Option<String>,
    pub queue_config: Option<String>,
    pub trim_stamps: Option<String>,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

/// A download joined with its video and (optional) playlist info: the shape the UI consumes.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, sqlx::FromRow)]
pub struct DownloadState {
    pub id: i64,
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub record: DownloadRecord,
    pub title: String,
    pub url: String,
    pub host: String,
    pub thumbnail: Option<String>,
    pub channel: Option<String>,
    pub duration_string: Option<String>,
    pub release_date: Option<String>,
    pub view_count: Option<i64>,
    pub like_count: Option<i64>,
    pub playlist_title: Option<String>,
    pub playlist_url: Option<String>,
    pub playlist_n_entries: Option<i64>,
    pub playlist_channel: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// Live progress persisted periodically while a download runs.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ProgressRow {
    pub status: Option<String>,
    pub item: Option<String>,
    pub progress: Option<f64>,
    pub total: Option<i64>,
    pub downloaded: Option<i64>,
    pub speed: Option<f64>,
    pub eta: Option<i64>,
    /// ffmpeg's live frame counter and fps; sent to the UI but not stored.
    pub frame: Option<i64>,
    pub fps: Option<f64>,
}

#[derive(Clone)]
pub struct Repo {
    pool: SqlitePool,
}

type Result<T> = std::result::Result<T, sqlx::Error>;

/// `downloads` joined with its video and optional playlist, followed by `$tail` (WHERE / ORDER BY).
/// A macro because sqlx wants a `'static` query string.
macro_rules! select_state {
    ($tail:literal) => {
        concat!(
            "SELECT downloads.*,
                video_info.title, video_info.url, video_info.host, video_info.thumbnail,
                video_info.channel, video_info.duration_string, video_info.release_date,
                video_info.view_count, video_info.like_count,
                playlist_info.playlist_title, playlist_info.playlist_url,
                playlist_info.playlist_n_entries, playlist_info.playlist_channel
             FROM downloads
             INNER JOIN video_info ON downloads.video_id = video_info.video_id
             LEFT JOIN playlist_info
                ON downloads.playlist_id = playlist_info.playlist_id
                AND downloads.playlist_id IS NOT NULL ",
            $tail
        )
    };
}

impl Repo {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn save_video_info(&self, v: &VideoInfoRow) -> Result<()> {
        sqlx::query(
            "INSERT INTO video_info (video_id, title, url, host, thumbnail, channel, duration_string, release_date, view_count, like_count)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(video_id) DO UPDATE SET
                title = excluded.title,
                url = excluded.url,
                host = excluded.host,
                thumbnail = excluded.thumbnail,
                channel = excluded.channel,
                duration_string = excluded.duration_string,
                release_date = excluded.release_date,
                view_count = excluded.view_count,
                like_count = excluded.like_count",
        )
        .bind(&v.video_id)
        .bind(&v.title)
        .bind(&v.url)
        .bind(&v.host)
        .bind(&v.thumbnail)
        .bind(&v.channel)
        .bind(&v.duration_string)
        .bind(&v.release_date)
        .bind(v.view_count)
        .bind(v.like_count)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn save_playlist_info(&self, p: &PlaylistInfoRow) -> Result<()> {
        sqlx::query(
            "INSERT INTO playlist_info (playlist_id, playlist_title, playlist_url, playlist_n_entries, playlist_channel)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(playlist_id) DO UPDATE SET
                playlist_title = excluded.playlist_title,
                playlist_url = excluded.playlist_url,
                playlist_n_entries = excluded.playlist_n_entries,
                playlist_channel = excluded.playlist_channel",
        )
        .bind(&p.playlist_id)
        .bind(&p.playlist_title)
        .bind(&p.playlist_url)
        .bind(p.playlist_n_entries)
        .bind(&p.playlist_channel)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Inserts or fully updates a download keyed by `download_id`.
    pub async fn save_download(&self, d: &DownloadRecord) -> Result<()> {
        sqlx::query(
            "INSERT INTO downloads (
                download_id, download_status, video_id, format_id, subtitle_id, queue_index,
                playlist_id, playlist_indices, process_id, resolution, ext, abr, vbr, acodec, vcodec,
                dynamic_range, status, item, progress, total, downloaded, speed, eta, filepath,
                filetype, filesize, output_format, embed_metadata, embed_thumbnail,
                square_crop_thumbnail, sponsorblock_remove, sponsorblock_mark, use_aria2,
                custom_command, queue_config, trim_stamps, error_message, started_at, completed_at
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19,
                ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36,
                ?37, ?38, ?39
             )
             ON CONFLICT(download_id) DO UPDATE SET
                download_status = excluded.download_status,
                video_id = excluded.video_id,
                format_id = excluded.format_id,
                subtitle_id = excluded.subtitle_id,
                queue_index = excluded.queue_index,
                playlist_id = excluded.playlist_id,
                playlist_indices = excluded.playlist_indices,
                process_id = excluded.process_id,
                resolution = excluded.resolution,
                ext = excluded.ext,
                abr = excluded.abr,
                vbr = excluded.vbr,
                acodec = excluded.acodec,
                vcodec = excluded.vcodec,
                dynamic_range = excluded.dynamic_range,
                status = excluded.status,
                item = excluded.item,
                progress = excluded.progress,
                total = excluded.total,
                downloaded = excluded.downloaded,
                speed = excluded.speed,
                eta = excluded.eta,
                filepath = excluded.filepath,
                filetype = excluded.filetype,
                filesize = excluded.filesize,
                output_format = excluded.output_format,
                embed_metadata = excluded.embed_metadata,
                embed_thumbnail = excluded.embed_thumbnail,
                square_crop_thumbnail = excluded.square_crop_thumbnail,
                sponsorblock_remove = excluded.sponsorblock_remove,
                sponsorblock_mark = excluded.sponsorblock_mark,
                use_aria2 = excluded.use_aria2,
                custom_command = excluded.custom_command,
                queue_config = excluded.queue_config,
                trim_stamps = excluded.trim_stamps,
                error_message = excluded.error_message,
                started_at = excluded.started_at,
                completed_at = excluded.completed_at",
        )
        .bind(&d.download_id)
        .bind(&d.download_status)
        .bind(&d.video_id)
        .bind(&d.format_id)
        .bind(&d.subtitle_id)
        .bind(d.queue_index)
        .bind(&d.playlist_id)
        .bind(&d.playlist_indices)
        .bind(d.process_id)
        .bind(&d.resolution)
        .bind(&d.ext)
        .bind(d.abr)
        .bind(d.vbr)
        .bind(&d.acodec)
        .bind(&d.vcodec)
        .bind(&d.dynamic_range)
        .bind(&d.status)
        .bind(&d.item)
        .bind(d.progress)
        .bind(d.total)
        .bind(d.downloaded)
        .bind(d.speed)
        .bind(d.eta)
        .bind(&d.filepath)
        .bind(&d.filetype)
        .bind(d.filesize)
        .bind(&d.output_format)
        .bind(d.embed_metadata)
        .bind(d.embed_thumbnail)
        .bind(d.square_crop_thumbnail)
        .bind(&d.sponsorblock_remove)
        .bind(&d.sponsorblock_mark)
        .bind(d.use_aria2)
        .bind(&d.custom_command)
        .bind(&d.queue_config)
        .bind(&d.trim_stamps)
        .bind(&d.error_message)
        .bind(&d.started_at)
        .bind(&d.completed_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    /// Sets `download_status`, maintaining `started_at` / `completed_at` / `error_message`.
    /// Returns whether a row matched.
    pub async fn set_status(&self, id: &str, status: &str, error: Option<&str>) -> Result<bool> {
        let result = sqlx::query(
            "UPDATE downloads SET
                download_status = ?2,
                started_at = CASE
                    WHEN ?2 IN ('starting', 'downloading') AND started_at IS NULL THEN CURRENT_TIMESTAMP
                    ELSE started_at END,
                completed_at = CASE WHEN ?2 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
                error_message = CASE
                    WHEN ?2 = 'errored' THEN ?3
                    WHEN ?2 IN ('starting', 'downloading', 'completed') THEN NULL
                    ELSE error_message END
             WHERE download_id = ?1",
        )
        .bind(id)
        .bind(status)
        .bind(error)
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn update_progress(&self, id: &str, p: &ProgressRow) -> Result<()> {
        sqlx::query(
            "UPDATE downloads SET
                status = ?2, item = COALESCE(?3, item), progress = ?4, total = ?5,
                downloaded = ?6, speed = ?7, eta = ?8
             WHERE download_id = ?1",
        )
        .bind(id)
        .bind(&p.status)
        .bind(&p.item)
        .bind(p.progress)
        .bind(p.total)
        .bind(p.downloaded)
        .bind(p.speed)
        .bind(p.eta)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn update_file_path(&self, id: &str, filepath: &str, ext: &str) -> Result<()> {
        sqlx::query("UPDATE downloads SET filepath = ?2, ext = ?3 WHERE download_id = ?1")
            .bind(id)
            .bind(filepath)
            .bind(ext)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn update_item(&self, id: &str, item: &str) -> Result<()> {
        sqlx::query("UPDATE downloads SET item = ?2 WHERE download_id = ?1")
            .bind(id)
            .bind(item)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_process_id(&self, id: &str, pid: Option<i64>) -> Result<()> {
        sqlx::query("UPDATE downloads SET process_id = ?2 WHERE download_id = ?1")
            .bind(id)
            .bind(pid)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_download(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM downloads WHERE download_id = ?1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Newest first, like `fetchAllDownloadStates`.
    pub async fn fetch_all(&self) -> Result<Vec<DownloadState>> {
        sqlx::query_as(select_state!("ORDER BY downloads.id DESC"))
            .fetch_all(&self.pool)
            .await
    }

    pub async fn fetch_by_id(&self, id: &str) -> Result<Option<DownloadState>> {
        sqlx::query_as(select_state!("WHERE downloads.download_id = ?1"))
            .bind(id)
            .fetch_optional(&self.pool)
            .await
    }

    /// Queued downloads in start order.
    pub async fn list_queued(&self) -> Result<Vec<DownloadState>> {
        sqlx::query_as(select_state!(
            "WHERE downloads.download_status = 'queued' ORDER BY downloads.queue_index ASC, downloads.id ASC"
        ))
        .fetch_all(&self.pool)
        .await
    }

    /// Reads the `settings` table (rows are `{"value": <v>}` JSON written by the frontend). Rows that
    /// don't parse are skipped, so one corrupt setting can't break downloading.
    pub async fn load_settings(&self) -> Result<DownloadSettings> {
        let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
            .fetch_all(&self.pool)
            .await?;
        let mut stored = serde_json::Map::new();
        for (key, raw) in rows {
            match serde_json::from_str::<serde_json::Value>(&raw) {
                Ok(mut wrapper) => {
                    if let Some(value) = wrapper.get_mut("value") {
                        stored.insert(key, value.take());
                    }
                }
                Err(e) => log::warn!("Ignoring unreadable setting '{key}': {e}"),
            }
        }
        Ok(DownloadSettings::from_map(&stored))
    }

    /// Quitting pauses queued downloads too, as the app always has.
    pub async fn pause_queued(&self) -> Result<u64> {
        let result = sqlx::query("UPDATE downloads SET download_status = 'paused' WHERE download_status = 'queued'")
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Marks downloads left `starting`/`downloading` by a previous run as `paused`.
    pub async fn recover_interrupted(&self) -> Result<u64> {
        let result = sqlx::query(
            "UPDATE downloads SET download_status = 'paused'
             WHERE download_status IN ('starting', 'downloading')",
        )
        .execute(&self.pool)
        .await?;
        Ok(result.rows_affected())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrations::get_migrations;
    use sqlx::sqlite::SqlitePoolOptions;

    /// Fresh in-memory DB with migrations 1..=`up_to` applied, exactly as the SQL plugin does.
    async fn pool_at(up_to: i64) -> SqlitePool {
        // One connection: every connection to ":memory:" would otherwise be a separate database.
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        for m in get_migrations().into_iter().filter(|m| m.version <= up_to) {
            sqlx::raw_sql(m.sql).execute(&pool).await.unwrap();
        }
        pool
    }

    async fn repo() -> Repo {
        Repo::new(pool_at(i64::MAX).await)
    }

    fn video(id: &str) -> VideoInfoRow {
        VideoInfoRow {
            video_id: id.into(),
            title: format!("Title of {id}"),
            url: format!("https://example.com/{id}"),
            host: "example.com".into(),
            ..Default::default()
        }
    }

    fn record(download_id: &str, video_id: &str, status: &str) -> DownloadRecord {
        DownloadRecord {
            download_id: download_id.into(),
            download_status: status.into(),
            video_id: video_id.into(),
            format_id: "137+140".into(),
            ..Default::default()
        }
    }

    async fn seed(repo: &Repo, download_id: &str, status: &str) {
        repo.save_video_info(&video("v1")).await.unwrap();
        repo.save_download(&record(download_id, "v1", status)).await.unwrap();
    }

    // ---------- migrations ----------

    #[tokio::test]
    async fn all_migrations_apply_to_a_fresh_database() {
        let pool = pool_at(i64::MAX).await;
        let cols: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info('downloads')")
            .fetch_all(&pool)
            .await
            .unwrap();
        for expected in ["trim_stamps", "error_message", "started_at", "completed_at"] {
            assert!(cols.iter().any(|c| c == expected), "missing column {expected}");
        }
        let index: Option<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_downloads_status_queue'",
        )
        .fetch_optional(&pool)
        .await
        .unwrap();
        assert!(index.is_some());
    }

    #[tokio::test]
    async fn v5_preserves_existing_v4_data() {
        let pool = pool_at(4).await;
        sqlx::query("INSERT INTO video_info (video_id, title, url, host) VALUES ('yt_abc', 'Old 日本語 video', 'https://y/abc', 'youtube.com')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO playlist_info (playlist_id, playlist_title, playlist_url, playlist_n_entries) VALUES ('yt_pl', 'PL', 'https://y/pl', 3)")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO downloads (download_id, download_status, video_id, format_id, playlist_id, playlist_indices, item, progress, filepath, trim_stamps, embed_metadata)
             VALUES ('d1', 'paused', 'yt_abc', '18', 'yt_pl', '1,2,3', '2/3', 41.5, 'C:\\x\\old.mp4', '5,9', 1)",
        )
        .execute(&pool)
        .await
        .unwrap();

        let v5 = get_migrations().into_iter().find(|m| m.version == 5).unwrap();
        sqlx::raw_sql(v5.sql).execute(&pool).await.unwrap();

        let state = Repo::new(pool).fetch_by_id("d1").await.unwrap().unwrap();
        assert_eq!(state.title, "Old 日本語 video");
        assert_eq!(state.record.download_status, "paused");
        assert_eq!(state.record.playlist_indices.as_deref(), Some("1,2,3"));
        assert_eq!(state.record.item.as_deref(), Some("2/3"));
        assert_eq!(state.record.progress, Some(41.5));
        assert_eq!(state.record.trim_stamps.as_deref(), Some("5,9"));
        assert_eq!(state.record.embed_metadata, 1);
        assert_eq!(state.playlist_title.as_deref(), Some("PL"));
        assert_eq!(state.playlist_n_entries, Some(3));
        assert!(state.record.error_message.is_none() && state.record.started_at.is_none());
    }

    // ---------- save / fetch ----------

    #[tokio::test]
    async fn save_and_fetch_joins_video_info() {
        let repo = repo().await;
        seed(&repo, "d1", "queued").await;
        let state = repo.fetch_by_id("d1").await.unwrap().unwrap();
        assert_eq!(state.title, "Title of v1");
        assert_eq!(state.host, "example.com");
        assert_eq!(state.record.format_id, "137+140");
        assert_eq!(state.playlist_title, None);
        assert!(state.created_at.is_some());
        assert!(repo.fetch_by_id("missing").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn save_download_upserts_by_download_id() {
        let repo = repo().await;
        seed(&repo, "d1", "queued").await;
        let mut rec = record("d1", "v1", "downloading");
        rec.progress = Some(12.5);
        rec.speed = Some(1000.5);
        rec.total = Some(5_000_000_000); // > i32
        repo.save_download(&rec).await.unwrap();

        let all = repo.fetch_all().await.unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].record.download_status, "downloading");
        assert_eq!(all[0].record.progress, Some(12.5));
        assert_eq!(all[0].record.total, Some(5_000_000_000));
    }

    #[tokio::test]
    async fn video_and_playlist_info_upsert() {
        let repo = repo().await;
        repo.save_video_info(&video("v1")).await.unwrap();
        let mut renamed = video("v1");
        renamed.title = "Renamed ✨".into();
        repo.save_video_info(&renamed).await.unwrap();
        repo.save_playlist_info(&PlaylistInfoRow {
            playlist_id: "p1".into(),
            playlist_title: "List".into(),
            playlist_url: "https://example.com/list".into(),
            playlist_n_entries: 7,
            playlist_channel: Some("Chan".into()),
        })
        .await
        .unwrap();
        let mut rec = record("d1", "v1", "queued");
        rec.playlist_id = Some("p1".into());
        repo.save_download(&rec).await.unwrap();

        let state = repo.fetch_by_id("d1").await.unwrap().unwrap();
        assert_eq!(state.title, "Renamed ✨");
        assert_eq!(state.playlist_title.as_deref(), Some("List"));
        assert_eq!(state.playlist_n_entries, Some(7));
        assert_eq!(state.playlist_channel.as_deref(), Some("Chan"));
    }

    #[tokio::test]
    async fn fetch_all_is_newest_first() {
        let repo = repo().await;
        seed(&repo, "d1", "queued").await;
        repo.save_download(&record("d2", "v1", "queued")).await.unwrap();
        repo.save_download(&record("d3", "v1", "queued")).await.unwrap();
        let ids: Vec<_> = repo.fetch_all().await.unwrap().into_iter().map(|s| s.record.download_id).collect();
        assert_eq!(ids, ["d3", "d2", "d1"]);
    }

    #[tokio::test]
    async fn downloads_without_video_info_are_hidden_like_before() {
        // The old query used an INNER JOIN with video_info.
        let repo = repo().await;
        sqlx::query("PRAGMA foreign_keys = OFF").execute(&repo.pool).await.unwrap();
        repo.save_download(&record("orphan", "nope", "queued")).await.unwrap();
        assert!(repo.fetch_all().await.unwrap().is_empty());
    }

    // ---------- updates ----------

    #[tokio::test]
    async fn set_status_tracks_timestamps_and_errors() {
        let repo = repo().await;
        seed(&repo, "d1", "queued").await;

        assert!(repo.set_status("d1", "starting", None).await.unwrap());
        let started = repo.fetch_by_id("d1").await.unwrap().unwrap().record.started_at;
        assert!(started.is_some());

        // started_at is kept across later transitions
        repo.set_status("d1", "downloading", None).await.unwrap();
        assert_eq!(repo.fetch_by_id("d1").await.unwrap().unwrap().record.started_at, started);

        repo.set_status("d1", "errored", Some("HTTP 403")).await.unwrap();
        let s = repo.fetch_by_id("d1").await.unwrap().unwrap();
        assert_eq!(s.record.download_status, "errored");
        assert_eq!(s.record.error_message.as_deref(), Some("HTTP 403"));

        // resuming clears the error; completing stamps completed_at
        repo.set_status("d1", "downloading", None).await.unwrap();
        assert!(repo.fetch_by_id("d1").await.unwrap().unwrap().record.error_message.is_none());
        repo.set_status("d1", "completed", None).await.unwrap();
        assert!(repo.fetch_by_id("d1").await.unwrap().unwrap().record.completed_at.is_some());

        assert!(!repo.set_status("missing", "paused", None).await.unwrap());
    }

    #[tokio::test]
    async fn update_progress_and_misc_fields() {
        let repo = repo().await;
        seed(&repo, "d1", "downloading").await;
        repo.update_progress(
            "d1",
            &ProgressRow {
                status: Some("downloading".into()),
                item: Some("2/5".into()),
                progress: Some(40.0),
                total: Some(1000),
                downloaded: Some(400),
                speed: Some(12.5),
                eta: Some(7),
                ..Default::default()
            },
        )
        .await
        .unwrap();
        repo.update_file_path("d1", "D:\\下载\\café.mp4", "mp4").await.unwrap();
        repo.set_process_id("d1", Some(4242)).await.unwrap();

        let r = repo.fetch_by_id("d1").await.unwrap().unwrap().record;
        assert_eq!((r.progress, r.downloaded, r.eta), (Some(40.0), Some(400), Some(7)));
        assert_eq!(r.item.as_deref(), Some("2/5"));
        assert_eq!(r.filepath.as_deref(), Some("D:\\下载\\café.mp4"));
        assert_eq!(r.ext.as_deref(), Some("mp4"));
        assert_eq!(r.process_id, Some(4242));

        repo.set_process_id("d1", None).await.unwrap();
        repo.update_item("d1", "3/5").await.unwrap();
        let r = repo.fetch_by_id("d1").await.unwrap().unwrap().record;
        assert_eq!((r.process_id, r.item.as_deref()), (None, Some("3/5")));
    }

    #[tokio::test]
    async fn delete_download_removes_the_row() {
        let repo = repo().await;
        seed(&repo, "d1", "paused").await;
        assert!(repo.delete_download("d1").await.unwrap());
        assert!(!repo.delete_download("d1").await.unwrap());
        assert!(repo.fetch_all().await.unwrap().is_empty());
    }

    // ---------- settings ----------

    #[tokio::test]
    async fn load_settings_unwraps_the_stored_json() {
        let repo = repo().await;
        testing::set_setting(&repo, "max_parallel_downloads", serde_json::json!(5)).await;
        testing::set_setting(&repo, "proxy_url", serde_json::json!("http://日本:1")).await;
        testing::set_setting(&repo, "use_proxy", serde_json::json!(true)).await;
        testing::set_setting(&repo, "theme", serde_json::json!("dark")).await;

        let s = repo.load_settings().await.unwrap();
        assert_eq!(s.max_parallel_downloads, 5);
        assert_eq!(s.proxy_url, "http://日本:1");
        assert!(s.use_proxy);
        assert_eq!(s.max_retries, 5, "defaults fill the gaps");
    }

    #[tokio::test]
    async fn load_settings_tolerates_corrupt_rows() {
        let repo = repo().await;
        sqlx::query("INSERT INTO settings (key, value) VALUES ('max_retries', 'not json')")
            .execute(&repo.pool)
            .await
            .unwrap();
        testing::set_setting(&repo, "use_proxy", serde_json::json!(true)).await;
        let s = repo.load_settings().await.unwrap();
        assert_eq!(s.max_retries, 5);
        assert!(s.use_proxy);
    }

    // ---------- queue / recovery ----------

    #[tokio::test]
    async fn list_queued_orders_by_queue_index() {
        let repo = repo().await;
        repo.save_video_info(&video("v1")).await.unwrap();
        for (id, idx, status) in [("a", 3, "queued"), ("b", 1, "queued"), ("c", 2, "queued"), ("d", 0, "paused")] {
            let mut r = record(id, "v1", status);
            r.queue_index = Some(idx);
            repo.save_download(&r).await.unwrap();
        }
        let ids: Vec<_> = repo.list_queued().await.unwrap().into_iter().map(|s| s.record.download_id).collect();
        assert_eq!(ids, ["b", "c", "a"]);
    }

    #[tokio::test]
    async fn recover_interrupted_pauses_only_running_downloads() {
        let repo = repo().await;
        repo.save_video_info(&video("v1")).await.unwrap();
        for (id, status) in [("s", "starting"), ("d", "downloading"), ("q", "queued"), ("c", "completed"), ("e", "errored")] {
            repo.save_download(&record(id, "v1", status)).await.unwrap();
        }
        assert_eq!(repo.recover_interrupted().await.unwrap(), 2);
        let status = |id: &'static str| {
            let repo = repo.clone();
            async move { repo.fetch_by_id(id).await.unwrap().unwrap().record.download_status }
        };
        assert_eq!(status("s").await, "paused");
        assert_eq!(status("d").await, "paused");
        assert_eq!(status("q").await, "queued");
        assert_eq!(status("c").await, "completed");
        assert_eq!(status("e").await, "errored");
        assert_eq!(repo.recover_interrupted().await.unwrap(), 0);
    }
}

/// Helpers shared with other modules' tests.
#[cfg(test)]
pub(crate) mod testing {
    use super::*;
    use crate::migrations::get_migrations;
    use sqlx::sqlite::SqlitePoolOptions;

    /// A migrated in-memory database (one connection, since each `:memory:` connection is its own DB).
    pub async fn memory_repo() -> Repo {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        for m in get_migrations() {
            sqlx::raw_sql(m.sql).execute(&pool).await.unwrap();
        }
        Repo::new(pool)
    }

    /// Stores a setting the way the frontend does: `{"value": <v>}`.
    pub async fn set_setting(repo: &Repo, key: &str, value: serde_json::Value) {
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES (?1, json_object('value', json(?2)))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(key)
        .bind(value.to_string())
        .execute(&repo.pool)
        .await
        .unwrap();
    }
}
