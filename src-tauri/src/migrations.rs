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
    },
    Migration {
        version: 2,
        description: "add_columns_to_downloads",
        sql: "
            ALTER TABLE downloads ADD COLUMN output_format TEXT;
            ALTER TABLE downloads ADD COLUMN embed_metadata INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE downloads ADD COLUMN embed_thumbnail INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE downloads ADD COLUMN sponsorblock_remove TEXT;
            ALTER TABLE downloads ADD COLUMN sponsorblock_mark TEXT;
            ALTER TABLE downloads ADD COLUMN created_at TEXT;
            ALTER TABLE downloads ADD COLUMN updated_at TEXT;
            
            -- Update existing rows with current timestamp
            UPDATE downloads SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
            UPDATE downloads SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;
            
            CREATE TRIGGER IF NOT EXISTS update_downloads_updated_at
                AFTER UPDATE ON downloads
                FOR EACH ROW
            BEGIN
                UPDATE downloads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END;
            
            -- Create trigger for new inserts to set created_at and updated_at
            CREATE TRIGGER IF NOT EXISTS set_downloads_timestamps
                AFTER INSERT ON downloads
                FOR EACH ROW
                WHEN NEW.created_at IS NULL OR NEW.updated_at IS NULL
            BEGIN
                UPDATE downloads
                SET created_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
                    updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
                WHERE id = NEW.id;
            END;
            ",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 3,
        description: "add_use_aria2_column_to_downloads_with_proper_position",
        sql: "
            -- Create temporary table with the new column in the correct position
            CREATE TABLE downloads_temp (
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
                output_format TEXT,
                embed_metadata INTEGER NOT NULL DEFAULT 0,
                embed_thumbnail INTEGER NOT NULL DEFAULT 0,
                sponsorblock_remove TEXT,
                sponsorblock_mark TEXT,
                use_aria2 INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES video_info (video_id),
                FOREIGN KEY (playlist_id) REFERENCES playlist_info (playlist_id)
            );
            
            -- Copy all data from original table to temporary table
            INSERT INTO downloads_temp SELECT 
                id, download_id, download_status, video_id, format_id, subtitle_id,
                queue_index, playlist_id, playlist_index, resolution, ext, abr, vbr,
                acodec, vcodec, dynamic_range, process_id, status, progress, total,
                downloaded, speed, eta, filepath, filetype, filesize, output_format,
                embed_metadata, embed_thumbnail, sponsorblock_remove, sponsorblock_mark,
                0, -- use_aria2 default value
                created_at, updated_at
            FROM downloads;
            
            -- Drop existing triggers for the original table
            DROP TRIGGER IF EXISTS update_downloads_updated_at;
            DROP TRIGGER IF EXISTS set_downloads_timestamps;

            -- Drop the original table
            DROP TABLE downloads;
            
            -- Rename temporary table to original name
            ALTER TABLE downloads_temp RENAME TO downloads;
            
            -- Create only the update trigger (as insert trigger not needed anymore)
            CREATE TRIGGER IF NOT EXISTS update_downloads_updated_at
                AFTER UPDATE ON downloads
                FOR EACH ROW
            BEGIN
                UPDATE downloads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END;
            ",
        kind: MigrationKind::Up,
    },
    Migration {
        version: 4,
        description: "add_custom_command_column_to_downloads",
        sql: "
            -- Create temporary table with the new column in the correct position
            CREATE TABLE downloads_temp (
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
                output_format TEXT,
                embed_metadata INTEGER NOT NULL DEFAULT 0,
                embed_thumbnail INTEGER NOT NULL DEFAULT 0,
                sponsorblock_remove TEXT,
                sponsorblock_mark TEXT,
                use_aria2 INTEGER NOT NULL DEFAULT 0,
                custom_command TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES video_info (video_id),
                FOREIGN KEY (playlist_id) REFERENCES playlist_info (playlist_id)
            );
            
            -- Copy all data from original table to temporary table
            INSERT INTO downloads_temp SELECT 
                id, download_id, download_status, video_id, format_id, subtitle_id,
                queue_index, playlist_id, playlist_index, resolution, ext, abr, vbr,
                acodec, vcodec, dynamic_range, process_id, status, progress, total,
                downloaded, speed, eta, filepath, filetype, filesize, output_format,
                embed_metadata, embed_thumbnail, sponsorblock_remove, sponsorblock_mark,
                use_aria2, NULL, -- custom_command default value
                created_at, updated_at
            FROM downloads;
            
            -- Drop existing triggers for the original table
            DROP TRIGGER IF EXISTS update_downloads_updated_at;

            -- Drop the original table
            DROP TABLE downloads;
            
            -- Rename temporary table to original name
            ALTER TABLE downloads_temp RENAME TO downloads;
            
            -- Re-Create the update trigger
            CREATE TRIGGER IF NOT EXISTS update_downloads_updated_at
                AFTER UPDATE ON downloads
                FOR EACH ROW
            BEGIN
                UPDATE downloads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END;
            ",
        kind: MigrationKind::Up,
    }]
}
