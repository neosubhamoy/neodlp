//! The download state machine as pure functions, so every transition can be tested without I/O.

use std::time::{Duration, Instant};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    Queued,
    Starting,
    Downloading,
    Paused,
    Errored,
    Completed,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Status::Queued => "queued",
            Status::Starting => "starting",
            Status::Downloading => "downloading",
            Status::Paused => "paused",
            Status::Errored => "errored",
            Status::Completed => "completed",
        }
    }

}

/// What the user asked for while a process was still running; consumed by the exit handler.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Intent {
    Pause,
    Cancel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitOutcome {
    Completed,
    Paused,
    /// The row is deleted.
    Cancelled,
    Errored,
}

/// How many more downloads may start. A limit of 0 is treated as 1.
pub fn slots_available(ongoing: usize, max_parallel: usize) -> usize {
    max_parallel.max(1).saturating_sub(ongoing)
}

/// Decides what a finished process means.
///
/// * `intent` wins: we killed the process ourselves, so its exit code says nothing.
/// * `completed` is whether the final file was reported (`Finalpath:`; for playlists the last item).
///   If the file is in place the download counts as completed even with a non-zero exit code.
/// * Otherwise a clean exit is a completion (e.g. yt-dlp found the file already downloaded and
///   printed no final path) and anything else is an error.
pub fn exit_outcome(intent: Option<Intent>, exit_success: bool, completed: bool) -> ExitOutcome {
    match intent {
        Some(Intent::Pause) => ExitOutcome::Paused,
        Some(Intent::Cancel) => ExitOutcome::Cancelled,
        None if completed || exit_success => ExitOutcome::Completed,
        None => ExitOutcome::Errored,
    }
}

/// Whether a playlist `item` string ("N/M") is the last item.
pub fn is_last_item(item: Option<&str>) -> bool {
    let Some((current, total)) = item.and_then(|i| i.split_once('/')) else {
        return false;
    };
    match (current.trim().parse::<u32>(), total.trim().parse::<u32>()) {
        (Ok(current), Ok(total)) => current == total,
        _ => false,
    }
}

/// The UI historically stored `x || null`, so zero and "missing" are the same thing.
pub fn nonzero_f64(v: Option<f64>) -> Option<f64> {
    v.filter(|v| *v != 0.0)
}

pub fn nonzero_i64(v: Option<i64>) -> Option<i64> {
    v.filter(|v| *v != 0)
}

/// Lets an event through at most once per `interval`.
pub struct Throttle {
    interval: Duration,
    last: Option<Instant>,
}

impl Throttle {
    pub fn new(interval: Duration) -> Self {
        Self { interval, last: None }
    }

    pub fn ready(&mut self, now: Instant) -> bool {
        let allowed = self
            .last
            .map_or(true, |last| now.saturating_duration_since(last) >= self.interval);
        if allowed {
            self.last = Some(now);
        }
        allowed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_strings_match_the_values_stored_in_the_database_and_used_by_the_ui() {
        let expected = [
            (Status::Queued, "queued"),
            (Status::Starting, "starting"),
            (Status::Downloading, "downloading"),
            (Status::Paused, "paused"),
            (Status::Errored, "errored"),
            (Status::Completed, "completed"),
        ];
        for (status, text) in expected {
            assert_eq!(status.as_str(), text);
        }
    }

    #[test]
    fn zero_parallel_limit_still_allows_one() {
        assert_eq!(slots_available(0, 0), 1);
        assert_eq!(slots_available(1, 0), 0);
    }

    #[test]
    fn slots_never_underflow() {
        assert_eq!(slots_available(0, 3), 3);
        assert_eq!(slots_available(2, 3), 1);
        assert_eq!(slots_available(3, 3), 0);
        assert_eq!(slots_available(9, 3), 0);
    }

    #[test]
    fn exit_outcome_table() {
        use ExitOutcome::*;
        use Intent::*;
        // (intent, exit_success, completed) -> outcome
        let cases = [
            (Some(Pause), false, false, Paused),
            (Some(Pause), true, true, Paused),
            (Some(Cancel), false, false, Cancelled),
            (Some(Cancel), true, true, Cancelled),
            (None, true, true, Completed),
            (None, true, false, Completed),
            (None, false, true, Completed),
            (None, false, false, Errored),
        ];
        for (intent, ok, done, want) in cases {
            assert_eq!(exit_outcome(intent, ok, done), want, "{intent:?} ok={ok} done={done}");
        }
    }

    #[test]
    fn last_playlist_item_detection() {
        assert!(is_last_item(Some("3/3")));
        assert!(is_last_item(Some("1/1")));
        assert!(!is_last_item(Some("2/3")));
        assert!(!is_last_item(None));
        assert!(!is_last_item(Some("garbage")));
        assert!(!is_last_item(Some("3/")));
        assert!(!is_last_item(Some("a/b")));
    }

    #[test]
    fn zero_means_null_like_the_old_ui_state() {
        assert_eq!(nonzero_f64(Some(0.0)), None);
        assert_eq!(nonzero_f64(Some(0.5)), Some(0.5));
        assert_eq!(nonzero_f64(None), None);
        assert_eq!(nonzero_i64(Some(0)), None);
        assert_eq!(nonzero_i64(Some(7)), Some(7));
    }

    #[test]
    fn throttle_limits_rate() {
        let mut t = Throttle::new(Duration::from_millis(250));
        let t0 = Instant::now();
        assert!(t.ready(t0));
        assert!(!t.ready(t0 + Duration::from_millis(100)));
        assert!(!t.ready(t0 + Duration::from_millis(249)));
        assert!(t.ready(t0 + Duration::from_millis(250)));
        // the window restarts from the last allowed event
        assert!(!t.ready(t0 + Duration::from_millis(300)));
        assert!(t.ready(t0 + Duration::from_millis(500)));
    }
}
