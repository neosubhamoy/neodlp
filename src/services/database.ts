import { Download, DownloadState } from '@/types/download'
import { KvStoreTable } from '@/types/kvStore'
import { PlaylistInfo } from '@/types/playlist'
import { SettingsTable } from '@/types/settings'
import { VideoInfo } from '@/types/video'
import Database from '@tauri-apps/plugin-sql'

// ------  Database schema  ------
// CREATE TABLE IF NOT EXISTS video_info (
//     id INTEGER PRIMARY KEY NOT NULL,
//     video_id TEXT UNIQUE NOT NULL,
//     title TEXT NOT NULL,
//     url TEXT NOT NULL,
//     host TEXT NOT NULL,
//     thumbnail TEXT,
//     channel TEXT,
//     duration_string TEXT,
//     release_date TEXT,
//     view_count INTEGER,
//     like_count INTEGER
// );
// CREATE TABLE IF NOT EXISTS playlist_info (
//     id INTEGER PRIMARY KEY NOT NULL,
//     playlist_id TEXT UNIQUE NOT NULL,
//     playlist_title TEXT NOT NULL,
//     playlist_url TEXT NOT NULL,
//     playlist_n_entries INTEGER NOT NULL,
//     playlist_channel TEXT,
// );
// CREATE TABLE IF NOT EXISTS downloads (
//     id INTEGER PRIMARY KEY NOT NULL,
//     download_id TEXT UNIQUE NOT NULL,
//     download_status TEXT NOT NULL,
//     video_id TEXT NOT NULL,
//     format_id TEXT NOT NULL,
//     subtitle_id TEXT,
//     queue_index INTEGER,
//     playlist_id TEXT,
//     playlist_index INTEGER,
//     resolution TEXT,
//     ext TEXT,
//     abr REAL,
//     vbr REAL,
//     acodec TEXT,
//     vcodec TEXT,
//     dynamic_range TEXT,
//     process_id INTEGER,
//     status TEXT,
//     progress REAL,
//     total INTEGER,
//     downloaded INTEGER,
//     speed REAL,
//     eta INTEGER,
//     filepath TEXT,
//     filetype TEXT,
//     filesize INTEGER,
//     FOREIGN KEY (video_id) REFERENCES video_info (video_id)
//     FOREIGN KEY (playlist_id) REFERENCES playlist_info (playlist_id)
// );
// CREATE TABLE IF NOT EXISTS settings (
//     id INTEGER PRIMARY KEY NOT NULL,
//     key TEXT UNIQUE NOT NULL,
//     value TEXT
// );

export const saveVideoInfo = async (videoInfo: VideoInfo) => {
    const db = await Database.load('sqlite:database.db')
    const result = await db.select<VideoInfo[]>(
        'SELECT * FROM video_info WHERE video_id = $1',
        [videoInfo.video_id]
    )
    if (result.length > 0) {
        return await db.execute(
            `UPDATE video_info SET
                title = $2,
                url = $3,
                host = $4,
                thumbnail = $5,
                channel = $6,
                duration_string = $7,
                release_date = $8,
                view_count = $9,
                like_count = $10
            WHERE video_id = $1`,
            [
                videoInfo.video_id,
                videoInfo.title,
                videoInfo.url,
                videoInfo.host,
                videoInfo.thumbnail,
                videoInfo.channel,
                videoInfo.duration_string,
                videoInfo.release_date,
                videoInfo.view_count,
                videoInfo.like_count
            ]
        )
    }
    return await db.execute(
        `INSERT INTO video_info (
            video_id,
            title, url,
            host,
            thumbnail,
            channel,
            duration_string,
            release_date,
            view_count,
            like_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
            videoInfo.video_id,
            videoInfo.title,
            videoInfo.url,
            videoInfo.host,
            videoInfo.thumbnail,
            videoInfo.channel,
            videoInfo.duration_string,
            videoInfo.release_date,
            videoInfo.view_count,
            videoInfo.like_count
        ]
    )
}

export const savePlaylistInfo = async (playlistInfo: PlaylistInfo) => {
    const db = await Database.load('sqlite:database.db')
    const result = await db.select<PlaylistInfo[]>(
        'SELECT * FROM playlist_info WHERE playlist_id = $1',
        [playlistInfo.playlist_id]
    )
    if (result.length > 0) {
        return await db.execute(
            `UPDATE playlist_info SET
                playlist_title = $2,
                playlist_url = $3,
                playlist_n_entries = $4,
                playlist_channel = $5
            WHERE playlist_id = $1`,
            [
                playlistInfo.playlist_id,
                playlistInfo.playlist_title,
                playlistInfo.playlist_url,
                playlistInfo.playlist_n_entries,
                playlistInfo.playlist_channel
            ]
        )
    }
    return await db.execute(
        `INSERT INTO playlist_info (
            playlist_id,
            playlist_title,
            playlist_url,
            playlist_n_entries,
            playlist_channel
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
            playlistInfo.playlist_id,
            playlistInfo.playlist_title,
            playlistInfo.playlist_url,
            playlistInfo.playlist_n_entries,
            playlistInfo.playlist_channel
        ]
    )
}

export const saveDownloadState = async (downloadState: DownloadState) => {
    const db = await Database.load('sqlite:database.db')
    const result = await db.select<Download[]>(
        'SELECT * FROM downloads WHERE download_id = $1',
        [downloadState.download_id]
    )
    if (result.length > 0) {
        return await db.execute(
            `UPDATE downloads SET
                download_status = $2,
                video_id = $3,
                format_id = $4,
                subtitle_id = $5,
                queue_index = $6,
                playlist_id = $7,
                playlist_index = $8,
                process_id = $9,
                resolution = $10,
                ext = $11,
                abr = $12,
                vbr = $13,
                acodec = $14,
                vcodec = $15,
                dynamic_range = $16,
                status = $17,
                progress = $18,
                total = $19,
                downloaded = $20,
                speed = $21,
                eta = $22,
                filepath = $23,
                filetype = $24,
                filesize = $25,
                output_format = $26,
                embed_metadata = $27,
                embed_thumbnail = $28,
                sponsorblock_remove = $29,
                sponsorblock_mark = $30,
                use_aria2 = $31,
                custom_command = $32,
                queue_config = $33
            WHERE download_id = $1`,
            [
                downloadState.download_id,
                downloadState.download_status,
                downloadState.video_id,
                downloadState.format_id,
                downloadState.subtitle_id,
                downloadState.queue_index,
                downloadState.playlist_id,
                downloadState.playlist_index,
                downloadState.process_id,
                downloadState.resolution,
                downloadState.ext,
                downloadState.abr,
                downloadState.vbr,
                downloadState.acodec,
                downloadState.vcodec,
                downloadState.dynamic_range,
                downloadState.status,
                downloadState.progress,
                downloadState.total,
                downloadState.downloaded,
                downloadState.speed,
                downloadState.eta,
                downloadState.filepath,
                downloadState.filetype,
                downloadState.filesize,
                downloadState.output_format,
                downloadState.embed_metadata,
                downloadState.embed_thumbnail,
                downloadState.sponsorblock_remove,
                downloadState.sponsorblock_mark,
                downloadState.use_aria2,
                downloadState.custom_command,
                downloadState.queue_config
            ]
        )
    }
    return await db.execute(
        `INSERT INTO downloads (
            download_id,
            download_status,
            video_id, format_id,
            subtitle_id,
            queue_index,
            playlist_id,
            playlist_index,
            process_id,
            resolution,
            ext,
            abr,
            vbr,
            acodec,
            vcodec,
            dynamic_range,
            status,
            progress,
            total,
            downloaded,
            speed,
            eta,
            filepath,
            filetype,
            filesize,
            output_format,
            embed_metadata,
            embed_thumbnail,
            sponsorblock_remove,
            sponsorblock_mark,
            use_aria2,
            custom_command,
            queue_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)`,
        [
            downloadState.download_id,
            downloadState.download_status,
            downloadState.video_id,
            downloadState.format_id,
            downloadState.subtitle_id,
            downloadState.queue_index,
            downloadState.playlist_id,
            downloadState.playlist_index,
            downloadState.process_id,
            downloadState.resolution,
            downloadState.ext,
            downloadState.abr,
            downloadState.vbr,
            downloadState.acodec,
            downloadState.vcodec,
            downloadState.dynamic_range,
            downloadState.status,
            downloadState.progress,
            downloadState.total,
            downloadState.downloaded,
            downloadState.speed,
            downloadState.eta,
            downloadState.filepath,
            downloadState.filetype,
            downloadState.filesize,
            downloadState.output_format,
            downloadState.embed_metadata,
            downloadState.embed_thumbnail,
            downloadState.sponsorblock_remove,
            downloadState.sponsorblock_mark,
            downloadState.use_aria2,
            downloadState.custom_command,
            downloadState.queue_config
        ]
    )
}

export const updateDownloadStatus = async (download_id: string, download_status: string) => {
    const db = await Database.load('sqlite:database.db')
    return await db.execute(
        'UPDATE downloads SET download_status = $2 WHERE download_id = $1',
        [download_id, download_status]
    )
}

export const updateDownloadFilePath = async (download_id: string, filepath: string, ext: string) => {
    const db = await Database.load('sqlite:database.db')
    return await db.execute(
        'UPDATE downloads SET filepath = $2, ext = $3 WHERE download_id = $1',
        [download_id, filepath, ext]
    )
}

export const deleteDownloadState = async (download_id: string) => {
    const db = await Database.load('sqlite:database.db')
    return await db.execute(
        'DELETE FROM downloads WHERE download_id = $1',
        [download_id]
    )
}

export const fetchAllDownloadStates = async () => {
    const db = await Database.load('sqlite:database.db')
    return await db.select<DownloadState[]>(
        `SELECT
            downloads.*,
            video_info.title,
            video_info.url,
            video_info.host,
            video_info.thumbnail,
            video_info.channel,
            video_info.duration_string,
            video_info.release_date,
            video_info.view_count,
            video_info.like_count,
            playlist_info.playlist_title,
            playlist_info.playlist_url,
            playlist_info.playlist_n_entries,
            playlist_info.playlist_channel
        FROM downloads
        INNER JOIN video_info
            ON downloads.video_id = video_info.video_id
        LEFT JOIN playlist_info
            ON downloads.playlist_id = playlist_info.playlist_id
            AND downloads.playlist_id IS NOT NULL
        ORDER BY downloads.id DESC`
    )
}

export const fetchAllSettings = async () => {
    const db = await Database.load('sqlite:database.db')
    const result = await db.select<SettingsTable[]>(
        `SELECT key, json_extract(value, '$.value') as value FROM settings`
    )
    if (result.length > 0) {
        return result.reduce((acc: { [key: string]: unknown }, curr) => {
            try {
                acc[curr.key] = JSON.parse(curr.value)
            } catch (e) {
                acc[curr.key] = curr.value
            }
            return acc
        }, {})
    }
    return {}
}

export const saveSettingsKey = async (key: string, value: unknown) => {
    const db = await Database.load('sqlite:database.db')
    const result = await db.select<SettingsTable[]>(
        'SELECT * FROM settings WHERE key = $1',
        [key]
    )
    const jsonValue = JSON.stringify(value)
    if (result.length > 0) {
        return await db.execute(
            `UPDATE settings SET value = json_object('value', json($2)) WHERE key = $1`,
            [key, jsonValue]
        )
    }
    return await db.execute(
        `INSERT INTO settings (key, value) VALUES ($1, json_object('value', json($2)))`,
        [key, jsonValue]
    )
}

export const resetSettings = async () => {
    const db = await Database.load('sqlite:database.db')
    return await db.execute(
        'DELETE FROM settings'
    )
}

export const fetchAllKvPairs = async () => {
    const db = await Database.load('sqlite:database.db')
    const result = await db.select<KvStoreTable[]>(
        `SELECT key, json_extract(value, '$.value') as value FROM kv_store`
    )
    if (result.length > 0) {
        return result.reduce((acc: { [key: string]: unknown }, curr) => {
            try {
                acc[curr.key] = JSON.parse(curr.value)
            } catch (e) {
                acc[curr.key] = curr.value
            }
            return acc
        }, {})
    }
    return {}
}

export const saveKvPair = async (key: string, value: unknown) => {
    const db = await Database.load('sqlite:database.db')
    const result = await db.select<KvStoreTable[]>(
        'SELECT * FROM kv_store WHERE key = $1',
        [key]
    )
    const jsonValue = JSON.stringify(value)
    if (result.length > 0) {
        return await db.execute(
            `UPDATE kv_store SET value = json_object('value', json($2)) WHERE key = $1`,
            [key, jsonValue]
        )
    }
    return await db.execute(
        `INSERT INTO kv_store (key, value) VALUES ($1, json_object('value', json($2)))`,
        [key, jsonValue]
    )
}

export const deleteKvPair = async (key: string) => {
    const db = await Database.load('sqlite:database.db')
    return await db.execute(
        'DELETE FROM kv_store WHERE key = $1',
        [key]
    )
}
