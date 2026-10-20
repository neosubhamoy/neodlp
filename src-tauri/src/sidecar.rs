//! The one place that knows how the app's helper programs (yt-dlp, neodlp-pot, ...) are located.
//! Every spawn site goes through [`Launcher`], so they cannot drift apart.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use tokio::process::Command;

/// What to run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Program {
    /// A binary bundled with the app (`externalBin`), such as `yt-dlp` or `neodlp-pot`.
    Sidecar(&'static str),
    /// An explicit path, e.g. a copy of yt-dlp that the user has permission to update.
    Path(PathBuf),
    /// A program from the system `PATH`, such as `pkexec` or `powershell`.
    System(&'static str),
}

pub fn is_flatpak() -> bool {
    std::env::var("FLATPAK").is_ok()
}

/// Sidecars are installed next to the app's executable (`.exe` on Windows).
pub fn sidecar_path(exe_dir: &Path, name: &str) -> PathBuf {
    let mut file = OsString::from(name);
    if cfg!(windows) {
        file.push(".exe");
    }
    exe_dir.join(file)
}

/// Flatpak builds can't execute their sidecars; yt-dlp is copied to `<data dir>/yt-dlp/yt-dlp` on
/// first run (and kept updated there).
pub fn flatpak_binary(data_dir: &Path, name: &str) -> PathBuf {
    data_dir.join(name).join(name)
}

#[derive(Debug, Clone)]
pub struct Launcher {
    exe_dir: PathBuf,
    data_dir: PathBuf,
    flatpak: bool,
}

impl Launcher {
    pub fn new(exe_dir: PathBuf, data_dir: PathBuf, flatpak: bool) -> Self {
        Self { exe_dir, data_dir, flatpak }
    }

    /// For the running app: next to the current executable, with the user's XDG data dir.
    pub fn for_current_app(data_dir: PathBuf) -> std::io::Result<Self> {
        let exe = std::env::current_exe()?;
        let exe_dir = exe
            .parent()
            .ok_or_else(|| std::io::Error::other("the executable has no parent directory"))?
            .to_path_buf();
        Ok(Self::new(exe_dir, data_dir, is_flatpak()))
    }

    pub fn exe_dir(&self) -> &Path {
        &self.exe_dir
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub fn is_flatpak(&self) -> bool {
        self.flatpak
    }

    pub fn program_path(&self, program: &Program) -> PathBuf {
        match program {
            Program::Sidecar("yt-dlp") if self.flatpak => flatpak_binary(&self.data_dir, "yt-dlp"),
            // Everything else Flatpak needs comes from the runtime's PATH.
            Program::Sidecar(name) if self.flatpak => PathBuf::from(name),
            Program::Sidecar(name) => sidecar_path(&self.exe_dir, name),
            Program::Path(path) => path.clone(),
            Program::System(name) => PathBuf::from(name),
        }
    }

    pub fn command(&self, program: &Program, args: Vec<String>) -> Command {
        let mut command = Command::new(self.program_path(program));
        command.args(args);
        command
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    fn launcher(flatpak: bool) -> Launcher {
        Launcher::new("/opt/neodlp".into(), "/home/u/.local/share".into(), flatpak)
    }

    fn program_of(command: &Command) -> &OsStr {
        command.as_std().get_program()
    }

    #[test]
    fn sidecars_live_next_to_the_executable() {
        let expected = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
        assert_eq!(
            launcher(false).program_path(&Program::Sidecar("yt-dlp")),
            Path::new("/opt/neodlp").join(expected)
        );
    }

    #[test]
    fn sidecar_names_with_dots_keep_them() {
        let path = sidecar_path(Path::new("/x"), "tool.v2");
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        assert_eq!(name, if cfg!(windows) { "tool.v2.exe" } else { "tool.v2" });
    }

    #[test]
    fn flatpak_runs_yt_dlp_from_the_data_dir() {
        assert_eq!(
            launcher(true).program_path(&Program::Sidecar("yt-dlp")),
            Path::new("/home/u/.local/share/yt-dlp/yt-dlp")
        );
    }

    #[test]
    fn flatpak_finds_other_tools_on_the_path() {
        assert_eq!(
            launcher(true).program_path(&Program::Sidecar("neodlp-pot")),
            Path::new("neodlp-pot")
        );
    }

    #[test]
    fn explicit_paths_and_system_programs_are_used_as_given() {
        let l = launcher(false);
        assert_eq!(l.program_path(&Program::Path("/a/b/yt-dlp".into())), Path::new("/a/b/yt-dlp"));
        assert_eq!(l.program_path(&Program::System("pkexec")), Path::new("pkexec"));
    }

    #[test]
    fn commands_carry_their_arguments_unchanged() {
        let args = vec!["--update-to".to_string(), "nightly".to_string(), "日本語 café".to_string()];
        let command = launcher(false).command(&Program::System("pkexec"), args.clone());
        assert_eq!(program_of(&command), "pkexec");
        let got: Vec<_> = command.as_std().get_args().map(|a| a.to_string_lossy().into_owned()).collect();
        assert_eq!(got, args);
    }

    #[test]
    fn exposes_its_directories() {
        let l = launcher(true);
        assert_eq!(l.exe_dir(), Path::new("/opt/neodlp"));
        assert_eq!(l.data_dir(), Path::new("/home/u/.local/share"));
        assert!(l.is_flatpak());
    }

    #[test]
    fn for_current_app_uses_the_running_executables_directory() {
        let l = Launcher::for_current_app("/data".into()).unwrap();
        let exe = std::env::current_exe().unwrap();
        assert_eq!(l.exe_dir(), exe.parent().unwrap());
    }
}
