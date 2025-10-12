### ✨ Changelog

- Fixed audio video not merging on macOS
- Removed bundling ffmpeg and ffprobe with linux (deb, rpm) builds as it conflicts (comes pre-installed) on lots of distros (ffmpeg is a dependency now which will be auto installed by your package manager)
- Added linux appimage builds (appimage builds does not support neodlp browser integration features due to their sandboxed nature)
- Other minor fixes and improvements

### 📝 Notes

> **🔴 DANGER:** This is a breaking update if you are coming from older version than `v0.3.0`. Users are adviced to complete/cancel all paused downloads before updating to this version, otherwise paused downloads may not resume properly or re-start from the begining.

> **⚠️ WARNING:** Linux users make sure `yt-dlp` and `deno` is not installed in your distro (otherwise you will get package installation conflict). Don't worry, You can still use yt-dlp cli as before (the only difference is that now it will be installed and auto-updated by neo-dlp, which You can also disable from neo-dlp Settings if you don't want to auto-update yt-dlp)

> This is an Un-Signed Build (Windows doesn't trust this Certificate so, it may flag this as malicious software, in that case, disable Windows SmartScreen and Defender, install it, and then re-enable them)

> This is an Un-Signed Build (MacOS doesn't trust this Certificate so, it may flag this as from 'unverified developer' and prevent it from opening, in that case, open Settings and allow it from 'Settings > Privacy and Security' section to get started)

### 📦 Shipped Binaries

| yt-dlp (updateable) | ffmpeg | ffprobe | aria2c | deno |
| :---- | :---- | :---- | :---- | :---- |
| v2025.10.11.232807 (nightly) | v7.1.1 | v7.1.1 | v1.37.0 | v2.5.4 |

> ‼️ Linux builds (deb, rpm) does not ships with `ffmpeg` and `ffprobe` (though it will be auto installed as a dependency by your package manager, if you are on fedora make sure to [enable rpmfusion free+nonfree repos](https://docs.fedoraproject.org/en-US/quick-docs/rpmfusion-setup/#_enabling_the_rpm_fusion_repositories_using_command_line_utilities) before installing the rpm package)

> ‼️ MacOS builds (dmg, app) does not ships with `aria2c`, If you want to use [aria2](https://formulae.brew.sh/formula/aria2) install it via [homebrew](https://brew.sh)

### ⬇️ Download Section

| Arch\OS | Windows (msi) ⬆️ | Windows (exe) ⬆️ | Linux (deb) | Linux (rpm) | Linux (appimage) ⬆️ | MacOS (dmg) ⬆️ | MacOS (app) ⬆️ |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| x86_64 | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64_en-US.msi) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64-setup.exe) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_amd64.deb) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP-<version>-1.x86_64.rpm) | ❕ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_amd64.Appimage) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64.dmg) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_x64.app.tar.gz) |
| ARM64 | N/A | 🪟 [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64-setup.exe) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_arm64.deb) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP-<version>-1.aarch64.rpm) | ❕ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_arm64.Appimage) | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_aarch64.dmg) | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_aarch64.app.tar.gz) |

> ⬆️ icon indicates this packaging format supports in-built app-updater

> 🪟 Windows x86_64 binary also works on ARM64 (Windows on ARM) devices with emulation (Not planning to release native Windows ARM64 build anytime soon as, x86_64 one works fine on ARM64 without noticeable performance impact)

> ❕ Linux appimage builds does not support neodlp's browser intergration features due to it's sandboxed nature (it is highly recommended to use native (deb, rpm, AUR) builds if possible for the full experiance, otherwise appimages are good for portable usage)

> ⚠️ MacOS ARM64 binary downloads are experimental and may not open on Apple Silicon Macs if downloaded from browser (You will get 'Damaged File' error) it's because the binaries are not signed (signing MacOS binaries requires 99$/year Apple Developer Account subscription, which I can't afford RN!) and Apple Silicon Macs don't allow unsigned apps (downloaded from browser) to be installed on the system. If you want to use NeoDLP on your Apple Silicon Macs, you can simply use the command line [Curl-Bash Installer](https://neodlp.neosubhamoy.com/download) (Recommended) -OR- [compile it from source](https://github.com/neosubhamoy/neodlp?tab=readme-ov-file#%EF%B8%8F-contributing--building-from-source) in your Mac
