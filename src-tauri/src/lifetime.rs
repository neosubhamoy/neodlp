//! Ties background processes (the PO-token server) to the lifetime of the app process.
//!
//! A clean quit stops them explicitly, but some exits never run our code: the Windows updater
//! installer exits the process directly, and a crash or a killed app does too. Child processes
//! outlive their parent, so the server would stay behind holding its port (and the installer can't
//! replace a running `neodlp-pot.exe`).
//!
//! On Windows every bound process joins one job object that kills its members when the last handle
//! to it closes. The only handle lives in this process, so the OS closes it however we end.
//! Elsewhere this does nothing: Linux's `PR_SET_PDEATHSIG` fires when the *thread* that spawned the
//! child exits (not the process), which would kill the server at random under a multi-threaded
//! runtime, and macOS has no equivalent. Those platforms rely on the explicit stop on exit.

use std::io;

/// Makes `pid` end when this process ends, however that happens.
pub fn bind_to_app(pid: u32) -> io::Result<()> {
    imp::bind_to_app(pid)
}

#[cfg(windows)]
mod imp {
    use std::io;
    use std::sync::OnceLock;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE};

    /// The job's handle, kept for the life of the process and never closed by us. (Stored as an
    /// integer because raw pointers aren't `Sync`.)
    static JOB: OnceLock<Result<usize, i32>> = OnceLock::new();

    fn create_job() -> Result<usize, i32> {
        // SAFETY: plain Win32 calls with valid arguments; the handle is closed on failure and
        // otherwise intentionally leaked (it must outlive every bound process).
        unsafe {
            let job: HANDLE = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err(io::Error::last_os_error().raw_os_error().unwrap_or(-1));
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if ok == 0 {
                let code = io::Error::last_os_error().raw_os_error().unwrap_or(-1);
                CloseHandle(job);
                return Err(code);
            }
            Ok(job as usize)
        }
    }

    pub fn bind_to_app(pid: u32) -> io::Result<()> {
        let job = JOB.get_or_init(create_job).map_err(|code| io::Error::from_raw_os_error(code))?;
        // SAFETY: `job` is a live job handle; the process handle is closed before returning.
        unsafe {
            let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
            if process.is_null() {
                return Err(io::Error::last_os_error());
            }
            let assigned = AssignProcessToJobObject(job as HANDLE, process);
            let error = io::Error::last_os_error();
            CloseHandle(process);
            if assigned == 0 {
                return Err(error);
            }
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use std::io;

    pub fn bind_to_app(_pid: u32) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    // The test binary doubles as the processes under test. `parent` starts a `sleeper`, binds it
    // and reports its pid; the real test then kills the parent and expects the sleeper to follow.
    #[test]
    fn fake_process() {
        match std::env::var("NEODLP_LIFETIME_FAKE").as_deref() {
            Ok("sleeper") => std::thread::sleep(Duration::from_secs(120)),
            Ok("parent") => {
                let sleeper = fake_command("sleeper").stdout(Stdio::null()).spawn().unwrap();
                bind_to_app(sleeper.id()).unwrap();
                println!("@@{}", sleeper.id());
                std::thread::sleep(Duration::from_secs(120));
            }
            _ => {}
        }
    }

    fn fake_command(mode: &str) -> Command {
        let mut cmd = Command::new(std::env::current_exe().unwrap());
        cmd.args(["--exact", "lifetime::tests::fake_process", "--nocapture", "--test-threads=1"])
            .env("NEODLP_LIFETIME_FAKE", mode);
        cmd
    }

    fn is_running(pid: u32) -> bool {
        let out = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).contains(&pid.to_string())
    }

    fn kill(pid: u32, tree: bool) {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/PID", &pid.to_string(), "/F"]);
        if tree {
            cmd.arg("/T");
        }
        let _ = cmd.output();
    }

    #[test]
    fn a_bound_process_ends_when_its_parent_is_killed() {
        let mut parent = fake_command("parent").stdout(Stdio::piped()).spawn().unwrap();
        let mut lines = BufReader::new(parent.stdout.take().unwrap()).lines();
        let sleeper: u32 = loop {
            let line = lines.next().expect("the parent exited early").unwrap();
            if let Some((_, pid)) = line.split_once("@@") {
                break pid.trim().parse().unwrap();
            }
        };
        assert!(is_running(sleeper), "the sleeper should be running");

        // Kill only the parent (no /T), as a crash or an installer exit would.
        kill(parent.id(), false);
        let _ = parent.wait();

        let deadline = Instant::now() + Duration::from_secs(10);
        while is_running(sleeper) && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(100));
        }
        let alive = is_running(sleeper);
        if alive {
            kill(sleeper, true); // don't leave it behind when the assertion fails
        }
        assert!(!alive, "the bound process outlived its parent");
    }

    #[test]
    fn binding_a_missing_process_is_an_error() {
        assert!(bind_to_app(u32::MAX - 1).is_err());
    }
}
