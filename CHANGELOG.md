### ✨ Changelog

- Added per-download configuration tweaks in downloader
- Added cookies support
- Added sponsorblock support (mark/remove segments)
- Added custom yt-dlp command support
- Added aria2 support (macos users need to install aria2 via homebrew to use this feature)
- Added force ipv protocol option in settings
- Added filename template option in settings
- Added real-time app session log viewer (monitor detailed yt-dlp logs)
- Improved download resume persistence (now more essential settings are preserved on resume)
- Added quick search button for completed downloads in library
- Fixed completed download sorting order (last completed on top)
- Ships with deno javascript runtime (as per new yt-dlp requirement)
- Added new linux arm64 builds (deb, rpm)
- Lots of other fixes and improvements

### 📝 Notes

> **🔴 DANGER:** This update introduces few breaking changes! Users are adviced to complete/cancel all paused downloads before updating to this version, otherwise paused downloads may not resume properly or re-start from the begining.

> **⚠️ WARNING:** Linux users make sure `yt-dlp`, `ffmpeg`, `ffprobe` and `deno` is not installed in your distro (otherwise you will get package installation conflict). Don't worry, You can still use yt-dlp cli as before (the only difference is that now it will be installed and auto-updated by neo-dlp, which You can also disable from neo-dlp Settings if you don't want to auto-update yt-dlp)

> This is an Un-Signed Build (Windows doesn't trust this Certificate so, it may flag this as malicious software, in that case, disable Windows SmartScreen and Defender, install it, and then re-enable them)

> This is an Un-Signed Build (MacOS doesn't trust this Certificate so, it may flag this as from 'unverified developer' and prevent it from opening, in that case, open Settings and allow it from 'Settings > Privacy and Security' section to get started)

### 📦 Shipped Binaries

| yt-dlp (updateable) | ffmpeg | ffprobe | aria2c | deno |
| :---- | :---- | :---- | :---- | :---- |
| v2025.10.01.232815 (nightly) | v7.1.1 | v7.1.1 | v1.37.0 | v2.5.3|

### ⬇️ Download Section

| Arch\OS | Windows (msi) ⬆️ | Windows (exe) ⬆️ | Linux (deb) | Linux (rpm) | MacOS (dmg) ⬆️ | MacOS (app) ⬆️ |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| x86_64 | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64_en-US.msi) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64-setup.exe) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_amd64.deb) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP-<version>-1.x86_64.rpm) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64.dmg) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_x64.app.tar.gz) |
| ARM64 | N/A | 🪟 [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64-setup.exe) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_arm64.deb) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP-<version>-1.aarch64.rpm) | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_aarch64.dmg) | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_aarch64.app.tar.gz) |

> ⬆️ icon indicates this packaging format supports in-built app-updater

> 🪟 Windows x86_64 binary also works on ARM64 (Windows on ARM) devices with emulation (Not planning to release native Windows ARM64 build anytime soon as, x86_64 one works fine on ARM64 without noticeable performance impact)

> ⚠️ MacOS ARM64 binary downloads are experimental and may not open on Apple Silicon Macs if downloaded from browser (You will get 'Damaged File' error) it's because the binaries are not signed (signing MacOS binaries requires 99$/year Apple Developer Account subscription, which I can't afford RN!) and Apple Silicon Macs don't allow unsigned apps (downloaded from browser) to be installed on the system. If you want to use NeoDLP on your Apple Silicon Macs, you can simply use the command line [Curl-Bash Installer](https://neodlp.neosubhamoy.com/download) (Recommended) -OR- [compile it from source](https://github.com/neosubhamoy/neodlp?tab=readme-ov-file#%EF%B8%8F-contributing--building-from-source) in your Mac
