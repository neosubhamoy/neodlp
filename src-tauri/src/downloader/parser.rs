//! Pure parsing of yt-dlp / aria2c / ffmpeg output lines. No I/O, so it is fully unit-testable.

use regex::Regex;
use std::sync::LazyLock;

#[derive(Debug, Clone, PartialEq)]
pub struct ProgressUpdate {
    pub status: String,
    pub progress: Option<f64>,
    pub speed: Option<f64>,
    pub downloaded: Option<i64>,
    pub total: Option<i64>,
    pub eta: Option<i64>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Line {
    /// A progress report from yt-dlp's progress template or from aria2c.
    Progress(ProgressUpdate),
    /// ffmpeg is running (segmented/trimmed downloads); it has no usable progress.
    Ffmpeg,
    /// `[download] Downloading item N of M`
    PlaylistItem { current: u32, total: u32 },
    /// `Finalpath: <path>` printed after the file is moved to its final location.
    FinalPath(String),
    /// Anything else; forwarded to the log.
    Log(String),
}

const FINAL_PATH_PREFIX: &str = "Finalpath: ";

static ARIA_PERCENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\((\d+(?:\.\d+)?)%\)").unwrap());
static ARIA_SIZES: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(\d+(?:\.\d+)?)(MiB|KiB|GiB|B)/(\d+(?:\.\d+)?)(MiB|KiB|GiB|B)").unwrap()
});
static ARIA_SPEED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"DL:(\d+(?:\.\d+)?)(KiB|MiB|GiB|B)").unwrap());
static ARIA_ETA: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"ETA:(\d+)s").unwrap());
static PLAYLIST_ITEM: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[download\] Downloading item (\d+) of (\d+)").unwrap());

fn to_bytes(value: f64, unit: &str) -> f64 {
    match unit {
        "KiB" => value * 1024.0,
        "MiB" => value * 1024.0 * 1024.0,
        "GiB" => value * 1024.0 * 1024.0 * 1024.0,
        _ => value,
    }
}

fn empty_update() -> ProgressUpdate {
    ProgressUpdate {
        status: "downloading".into(),
        progress: None,
        speed: None,
        downloaded: None,
        total: None,
        eta: None,
    }
}

/// Parses `status:..,progress:..,speed:..,downloaded:..,total:..,eta:..` (our `--progress-template`).
/// Values that are missing or not numeric (`NA`, `N/A`, `nan`) become `None`.
fn parse_template(text: &str) -> ProgressUpdate {
    let mut update = empty_update();
    for pair in text.split(',') {
        let Some((key, value)) = pair.split_once(':') else {
            continue;
        };
        let value = value.trim();
        if value.is_empty() {
            continue;
        }
        match key.trim() {
            "status" => update.status = value.to_string(),
            "progress" => update.progress = value.trim_end_matches('%').trim().parse().ok(),
            "speed" => update.speed = value.parse::<f64>().ok().filter(|v| v.is_finite()),
            "downloaded" => update.downloaded = value.parse().ok(),
            "total" => update.total = value.parse().ok(),
            "eta" => update.eta = value.parse().ok(),
            _ => {}
        }
    }
    update
}

/// Parses aria2c's summary: `[#99f72b 2.5MiB/3.4MiB(75%) CN:1 DL:503KiB ETA:1s]`.
fn parse_aria2(line: &str) -> ProgressUpdate {
    let mut update = empty_update();
    if let Some(c) = ARIA_PERCENT.captures(line) {
        update.progress = c[1].parse().ok();
    }
    if let Some(c) = ARIA_SIZES.captures(line) {
        if let (Ok(done), Ok(total)) = (c[1].parse::<f64>(), c[3].parse::<f64>()) {
            update.downloaded = Some(to_bytes(done, &c[2]) as i64);
            update.total = Some(to_bytes(total, &c[4]) as i64);
        }
    }
    if let Some(c) = ARIA_SPEED.captures(line) {
        update.speed = c[1].parse::<f64>().ok().map(|v| to_bytes(v, &c[2]));
    }
    if let Some(c) = ARIA_ETA.captures(line) {
        update.eta = c[1].parse().ok();
    }
    update
}

pub fn parse_line(line: &str) -> Line {
    let line = line.trim_end_matches(['\r', '\n']);

    if let Some(path) = line.strip_prefix(FINAL_PATH_PREFIX) {
        return Line::FinalPath(path.to_string());
    }
    if line.trim_start().starts_with("frame=") {
        return Line::Ffmpeg;
    }
    // aria2c and yt-dlp output can be interleaved on one line: "[#..]status:downloading,..."
    if let Some(idx) = line.find("]status:") {
        return Line::Progress(parse_template(&line[idx + 1..]));
    }
    if line.starts_with("[#") && line.contains('%') {
        return Line::Progress(parse_aria2(line));
    }
    if line.starts_with("status:") {
        return Line::Progress(parse_template(line));
    }
    if let Some(c) = PLAYLIST_ITEM.captures(line) {
        if let (Ok(current), Ok(total)) = (c[1].parse(), c[2].parse()) {
            return Line::PlaylistItem { current, total };
        }
    }
    Line::Log(line.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Output arrives as raw bytes decoded lossily (see `process::next_line`).
    fn parse_line_bytes(bytes: &[u8]) -> Line {
        parse_line(&String::from_utf8_lossy(bytes))
    }

    fn progress(line: &str) -> ProgressUpdate {
        match parse_line(line) {
            Line::Progress(p) => p,
            other => panic!("expected progress, got {other:?}"),
        }
    }

    #[test]
    fn parses_ytdlp_template_line() {
        let p = progress(
            "status:downloading,progress: 75.1%,speed:1022692.427018,downloaded:30289474,total:40331784,eta:9",
        );
        assert_eq!(p.status, "downloading");
        assert_eq!(p.progress, Some(75.1));
        assert_eq!(p.speed, Some(1022692.427018));
        assert_eq!(p.downloaded, Some(30289474));
        assert_eq!(p.total, Some(40331784));
        assert_eq!(p.eta, Some(9));
    }

    #[test]
    fn na_values_are_none() {
        let p = progress(
            "status:downloading,progress:  N/A%,speed:NA,downloaded:1024,total:NA,eta:NA",
        );
        assert_eq!(p.progress, None);
        assert_eq!(p.speed, None);
        assert_eq!(p.total, None);
        assert_eq!(p.eta, None);
        assert_eq!(p.downloaded, Some(1024));
    }

    #[test]
    fn nan_speed_is_none() {
        assert_eq!(progress("status:downloading,speed:nan").speed, None);
    }

    #[test]
    fn finished_status_is_kept() {
        assert_eq!(progress("status:finished,progress:100.0%").status, "finished");
    }

    #[test]
    fn status_defaults_to_downloading() {
        assert_eq!(progress("status:").status, "downloading");
    }

    #[test]
    fn tolerates_crlf() {
        let p = progress("status:downloading,progress:50.0%,eta:3\r\n");
        assert_eq!(p.progress, Some(50.0));
        assert_eq!(p.eta, Some(3));
    }

    #[test]
    fn parses_aria2_line() {
        let p = progress("[#99f72b 2.5MiB/3.4MiB(75%) CN:1 DL:503KiB ETA:1s]");
        assert_eq!(p.status, "downloading");
        assert_eq!(p.progress, Some(75.0));
        assert_eq!(p.downloaded, Some((2.5 * 1024.0 * 1024.0) as i64));
        assert_eq!(p.total, Some((3.4 * 1024.0 * 1024.0) as i64));
        assert_eq!(p.speed, Some(503.0 * 1024.0));
        assert_eq!(p.eta, Some(1));
    }

    #[test]
    fn parses_aria2_gib_and_byte_units() {
        let p = progress("[#a1 512B/1.5GiB(0%) CN:16 DL:0B]");
        assert_eq!(p.downloaded, Some(512));
        assert_eq!(p.total, Some((1.5 * 1024.0 * 1024.0 * 1024.0) as i64));
        assert_eq!(p.speed, Some(0.0));
        assert_eq!(p.eta, None);
    }

    #[test]
    fn parses_combined_aria2_and_ytdlp_line() {
        let p = progress("[#99f72b 1MiB/2MiB(50%)]status:downloading,progress:50.0%,speed:1000.5,downloaded:1048576,total:2097152,eta:4");
        assert_eq!(p.progress, Some(50.0));
        assert_eq!(p.speed, Some(1000.5));
        assert_eq!(p.eta, Some(4));
    }

    #[test]
    fn ffmpeg_frame_lines() {
        assert_eq!(
            parse_line("frame= 3376 fps= 46 q=-1.0 size= 31488KiB time=00:02:15.80 bitrate=1899.4kbits/s speed=1.87x"),
            Line::Ffmpeg
        );
        assert_eq!(parse_line("  frame=1 fps=0"), Line::Ffmpeg);
    }

    #[test]
    fn playlist_item_line() {
        assert_eq!(
            parse_line("[download] Downloading item 3 of 12"),
            Line::PlaylistItem { current: 3, total: 12 }
        );
    }

    #[test]
    fn final_path_line() {
        assert_eq!(
            parse_line("Finalpath: C:\\Users\\me\\Downloads\\NeoDLP\\video[id].mp4"),
            Line::FinalPath("C:\\Users\\me\\Downloads\\NeoDLP\\video[id].mp4".into())
        );
    }

    #[test]
    fn final_path_keeps_colons_and_spaces_and_strips_line_ending() {
        assert_eq!(
            parse_line("Finalpath: /home/me/a: b  c.mkv\r\n"),
            Line::FinalPath("/home/me/a: b  c.mkv".into())
        );
    }

    #[test]
    fn other_lines_are_logs() {
        assert_eq!(
            parse_line("[download] Destination: video.mp4"),
            Line::Log("[download] Destination: video.mp4".into())
        );
        assert_eq!(parse_line(""), Line::Log(String::new()));
    }

    #[test]
    fn non_ascii_titles_and_paths() {
        assert_eq!(
            parse_line("Finalpath: D:\\下载\\日本語のタイトル 🎬 café.mp4"),
            Line::FinalPath("D:\\下载\\日本語のタイトル 🎬 café.mp4".into())
        );
        assert_eq!(
            parse_line("[download] Destination: Привет мир.webm"),
            Line::Log("[download] Destination: Привет мир.webm".into())
        );
    }

    #[test]
    fn invalid_utf8_never_panics_and_is_replaced() {
        // "Finalpath: caf" + Latin-1 0xE9 ("é" in cp1252) + ".mp4": the exact failure mode behind
        // "invalid utf-8 sequence of 1 bytes".
        let bytes = b"Finalpath: caf\xE9.mp4";
        assert_eq!(
            parse_line_bytes(bytes),
            Line::FinalPath("caf\u{FFFD}.mp4".into())
        );
    }

    #[test]
    fn invalid_utf8_in_log_lines() {
        assert_eq!(
            parse_line_bytes(b"[download] \x93\x82\x89\xE6"),
            Line::Log("[download] \u{FFFD}\u{FFFD}\u{FFFD}\u{FFFD}".into())
        );
    }
}
