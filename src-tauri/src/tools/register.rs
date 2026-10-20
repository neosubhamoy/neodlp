//! First-run registration: copying the browser-extension manifests, autostart entry and yt-dlp
//! plugins into the places the OS and browsers look. Replaces `src/hooks/use-macos-registerer.ts`
//! and `src/hooks/use-linux-registerer.ts`.

use std::path::{Path, PathBuf};

const POT_PLUGIN_DIR: &str = "yt-dlp-plugins/bgutil-ytdlp-pot-provider/yt_dlp_plugins/extractor";
const POT_PLUGIN_FILES: [&str; 3] = ["getpot_bgutil.py", "getpot_bgutil_cli.py", "getpot_bgutil_http.py"];
const FLATPAK_RESOURCE_DIR: &str = "/app/lib/neodlp";
const FLATPAK_APP_DIR: &str = ".var/app/com.neosubhamoy.neodlp";

/// One file to install: `source` is relative to the app's resource dir, `destination` to the
/// user's home directory.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileCopy {
    pub source: String,
    pub destination: String,
}

fn copy(source: &str, destination: &str) -> FileCopy {
    FileCopy { source: source.into(), destination: destination.into() }
}

/// The yt-dlp PO-token provider plugin, installed under `destination_prefix` in the home dir.
fn pot_plugin_files(destination_prefix: &str) -> impl Iterator<Item = FileCopy> + '_ {
    POT_PLUGIN_FILES.iter().map(move |file| {
        let relative = format!("{POT_PLUGIN_DIR}/{file}");
        copy(&relative, &format!("{destination_prefix}{relative}"))
    })
}

pub fn macos_files() -> Vec<FileCopy> {
    const NATIVE_MESSAGING: &str = "NativeMessagingHosts/com.neosubhamoy.neodlp.json";
    let mut files = vec![
        copy("neodlp-autostart.plist", "Library/LaunchAgents/com.neosubhamoy.neodlp.plist"),
        copy(
            "neodlp-msghost.json",
            &format!("Library/Application Support/Google/Chrome/{NATIVE_MESSAGING}"),
        ),
        copy(
            "neodlp-msghost.json",
            &format!("Library/Application Support/Chromium/{NATIVE_MESSAGING}"),
        ),
        copy(
            "neodlp-msghost-moz.json",
            &format!("Library/Application Support/Mozilla/{NATIVE_MESSAGING}"),
        ),
    ];
    files.extend(pot_plugin_files(""));
    files
}

pub fn linux_files(flatpak: bool) -> Vec<FileCopy> {
    if !flatpak {
        return pot_plugin_files("").collect();
    }
    let mut files = vec![copy("yt-dlp", &format!("{FLATPAK_APP_DIR}/data/yt-dlp/yt-dlp"))];
    files.extend(pot_plugin_files(&format!("{FLATPAK_APP_DIR}/config/")));
    files
}

/// Flatpak ships its resources at a fixed place instead of next to the executable.
pub fn linux_resource_dir(flatpak: bool, resource_dir: &Path) -> PathBuf {
    if flatpak {
        PathBuf::from(FLATPAK_RESOURCE_DIR)
    } else {
        resource_dir.to_path_buf()
    }
}

/// Copies every file, creating directories as needed and replacing existing files. Stops at the
/// first failure and names the file in the error.
pub fn copy_files(resource_dir: &Path, home: &Path, files: &[FileCopy]) -> Result<(), String> {
    for file in files {
        let source = resource_dir.join(&file.source);
        let destination = home.join(&file.destination);
        let fail = |e: std::io::Error| {
            format!("Failed to copy {} to {}: {e}", file.source, destination.display())
        };
        if let Some(dir) = destination.parent() {
            std::fs::create_dir_all(dir).map_err(fail)?;
        }
        // fs::copy keeps permission bits, so the Flatpak yt-dlp stays executable.
        std::fs::copy(&source, &destination).map_err(fail)?;
        log::info!("Copied {} to {}", file.source, destination.display());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn pair(source: &str, destination: &str) -> FileCopy {
        FileCopy { source: source.into(), destination: destination.into() }
    }

    fn plugin(prefix: &str, file: &str) -> FileCopy {
        let rel = format!("{POT_PLUGIN_DIR}/{file}");
        pair(&rel, &format!("{prefix}{rel}"))
    }

    // ---------- file lists (mirror the old TypeScript lists exactly) ----------

    #[test]
    fn macos_installs_the_autostart_entry_manifests_and_plugins() {
        let mut expected = vec![
            pair("neodlp-autostart.plist", "Library/LaunchAgents/com.neosubhamoy.neodlp.plist"),
            pair(
                "neodlp-msghost.json",
                "Library/Application Support/Google/Chrome/NativeMessagingHosts/com.neosubhamoy.neodlp.json",
            ),
            pair(
                "neodlp-msghost.json",
                "Library/Application Support/Chromium/NativeMessagingHosts/com.neosubhamoy.neodlp.json",
            ),
            pair(
                "neodlp-msghost-moz.json",
                "Library/Application Support/Mozilla/NativeMessagingHosts/com.neosubhamoy.neodlp.json",
            ),
        ];
        expected.extend(POT_PLUGIN_FILES.iter().map(|f| plugin("", f)));
        assert_eq!(macos_files(), expected);
    }

    #[test]
    fn linux_installs_only_the_plugins() {
        let expected: Vec<_> = POT_PLUGIN_FILES.iter().map(|f| plugin("", f)).collect();
        assert_eq!(linux_files(false), expected);
    }

    #[test]
    fn flatpak_installs_its_own_yt_dlp_and_plugins_under_its_app_dir() {
        let mut expected = vec![pair("yt-dlp", ".var/app/com.neosubhamoy.neodlp/data/yt-dlp/yt-dlp")];
        expected.extend(
            POT_PLUGIN_FILES
                .iter()
                .map(|f| plugin(".var/app/com.neosubhamoy.neodlp/config/", f)),
        );
        assert_eq!(linux_files(true), expected);
    }

    #[test]
    fn flatpak_resources_come_from_the_fixed_location() {
        assert_eq!(linux_resource_dir(true, Path::new("/ignored")), Path::new("/app/lib/neodlp"));
        assert_eq!(linux_resource_dir(false, Path::new("/usr/lib/neodlp")), Path::new("/usr/lib/neodlp"));
    }

    // ---------- copying ----------

    fn write(root: &Path, rel: &str, bytes: &[u8]) {
        let path = root.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, bytes).unwrap();
    }

    #[test]
    fn copies_files_creating_missing_directories() {
        let resources = tempfile::tempdir().unwrap();
        let home = tempfile::tempdir().unwrap();
        write(resources.path(), "a/b.json", b"{\"k\":1}");
        let files = [pair("a/b.json", "Library/Application Support/Deep Dir/日本語/x.json")];

        copy_files(resources.path(), home.path(), &files).unwrap();

        let copied = home.path().join("Library/Application Support/Deep Dir/日本語/x.json");
        assert_eq!(fs::read(copied).unwrap(), b"{\"k\":1}");
    }

    #[test]
    fn one_source_can_be_installed_in_several_places() {
        let resources = tempfile::tempdir().unwrap();
        let home = tempfile::tempdir().unwrap();
        write(resources.path(), "m.json", b"manifest");
        let files = [pair("m.json", "one/m.json"), pair("m.json", "two/m.json")];
        copy_files(resources.path(), home.path(), &files).unwrap();
        assert_eq!(fs::read(home.path().join("one/m.json")).unwrap(), b"manifest");
        assert_eq!(fs::read(home.path().join("two/m.json")).unwrap(), b"manifest");
    }

    #[test]
    fn replaces_existing_files_and_keeps_binary_content_intact() {
        let resources = tempfile::tempdir().unwrap();
        let home = tempfile::tempdir().unwrap();
        let binary: Vec<u8> = (0..=255u8).cycle().take(100_000).collect();
        write(resources.path(), "blob.bin", &binary);
        write(home.path(), "dest/blob.bin", b"old contents");

        copy_files(resources.path(), home.path(), &[pair("blob.bin", "dest/blob.bin")]).unwrap();
        assert_eq!(fs::read(home.path().join("dest/blob.bin")).unwrap(), binary);
    }

    #[test]
    fn a_missing_source_names_the_file_and_stops() {
        let resources = tempfile::tempdir().unwrap();
        let home = tempfile::tempdir().unwrap();
        write(resources.path(), "first.txt", b"1");
        write(resources.path(), "third.txt", b"3");
        let files = [pair("first.txt", "first.txt"), pair("missing.txt", "second.txt"), pair("third.txt", "third.txt")];

        let err = copy_files(resources.path(), home.path(), &files).unwrap_err();
        assert!(err.contains("missing.txt"), "{err}");
        assert!(home.path().join("first.txt").exists());
        assert!(!home.path().join("third.txt").exists(), "must stop at the first failure");
    }

    #[cfg(unix)]
    #[test]
    fn keeps_the_executable_bit() {
        use std::os::unix::fs::PermissionsExt;
        let resources = tempfile::tempdir().unwrap();
        let home = tempfile::tempdir().unwrap();
        write(resources.path(), "yt-dlp", b"#!/bin/sh\n");
        fs::set_permissions(resources.path().join("yt-dlp"), fs::Permissions::from_mode(0o755)).unwrap();

        copy_files(resources.path(), home.path(), &[pair("yt-dlp", "bin/yt-dlp")]).unwrap();
        let mode = fs::metadata(home.path().join("bin/yt-dlp")).unwrap().permissions().mode();
        assert_eq!(mode & 0o111, 0o111);
    }
}
