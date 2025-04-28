use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "
            CREATE TABLE IF NOT EXISTS video_info (
                id INTEGER PRIMARY KEY NOT NULL,
                video_id TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                host TEXT NOT NULL,
                thumbnail TEXT,
                channel TEXT,
                duration_string TEXT,
                release_date TEXT,
                view_count INTEGER,
                like_count INTEGER
            );
            CREATE TABLE IF NOT EXISTS playlist_info (
                id INTEGER PRIMARY KEY NOT NULL,
                playlist_id TEXT UNIQUE NOT NULL,
                playlist_title TEXT NOT NULL,
                playlist_url TEXT NOT NULL,
                playlist_n_entries INTEGER NOT NULL,
                playlist_channel TEXT
            );
            CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY NOT NULL,
                download_id TEXT UNIQUE NOT NULL,
                download_status TEXT NOT NULL,
                video_id TEXT NOT NULL,
                format_id TEXT NOT NULL,
                subtitle_id TEXT,
                queue_index INTEGER,
                playlist_id TEXT,
                playlist_index INTEGER,
                resolution TEXT,
                ext TEXT,
                abr REAL,
                vbr REAL,
                acodec TEXT,
                vcodec TEXT,
                dynamic_range TEXT,
                process_id INTEGER,
                status TEXT,
                progress REAL,
                total INTEGER,
                downloaded INTEGER,
                speed REAL,
                eta INTEGER,
                filepath TEXT,
                filetype TEXT,
                filesize INTEGER,
                FOREIGN KEY (video_id) REFERENCES video_info (video_id),
                FOREIGN KEY (playlist_id) REFERENCES playlist_info (playlist_id)
            );
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY NOT NULL,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS kv_store (
                id INTEGER PRIMARY KEY NOT NULL,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL
            );
            ",
        kind: MigrationKind::Up,
    }]
}
