### ✨ Changelog

- Added support for selective-batch/full-playlist download
- Added support for selecting multiple audio streams on combine mode
- Added support for embedding original auto-generated subtitles
- Added option to crop thubnails to square (1:1) before embedding
- Added 'errored' download state (to better identify errored downloads, which you can retry later)
- Added app interface color scheme options on appearance settings
- Added app info page under settings
- Added copy/clear log buttons in log viewer
- Added sponsorblock 'hook' category
- Fixed sidebar state not persisting on app re-start
- Fixed linux native (deb/rpm) installation downloading appimage update
- Bumped up shadcn/ui to v3.5 and lots of under the hood ui improvements
- Optimized database and backend performance
- Lots of other fixes and improvements

### 📝 Notes

> [!CAUTION]
> This update introduces few breaking changes! Users are adviced to complete/cancel all paused downloads before updating to this version, otherwise paused downloads may not resume properly or re-start from the begining.

> [!WARNING]
> Linux users make sure `yt-dlp` and `deno` is not installed in your distro (otherwise you will get package installation conflict). Don't worry, You can still use yt-dlp cli as before (the only difference is that now it will be installed and auto-updated by neo-dlp, which You can also disable from neo-dlp Settings if you don't want to auto-update yt-dlp)

> This is an Un-Signed Build (Windows doesn't trust this Certificate so, it may flag this as malicious software, in that case, disable Windows SmartScreen and Defender, install it, and then re-enable them)

> This is an Un-Signed Build (MacOS doesn't trust this Certificate so, it may flag this as from 'unverified developer' and prevent it from opening, in that case, open Settings and allow it from 'Settings > Privacy and Security' section to get started)

### 📦 Shipped Binaries

| yt-dlp (updateable) | ffmpeg | ffprobe | aria2c | deno |
| :---- | :---- | :---- | :---- | :---- |
| v2026.01.19.233146 (nightly) | v7.1.1 | v7.1.1 | v1.37.0 | v2.6.5 |

> ‼️ Linux builds (deb, rpm) does not ships with `ffmpeg` and `ffprobe` (though it will be auto installed as a dependency by your package manager, if you are on fedora make sure to [enable rpmfusion free+nonfree repos](https://docs.fedoraproject.org/en-US/quick-docs/rpmfusion-setup/#_enabling_the_rpm_fusion_repositories_using_command_line_utilities) before installing the rpm package)

> ‼️ MacOS builds (dmg, app) does not ships with `aria2c`, If you want to use [aria2](https://formulae.brew.sh/formula/aria2) install it via [homebrew](https://brew.sh)

### ⬇️ Download Section

| Architecture | Windows (msi) ⬆️ | Windows (exe) ⬆️ | Linux (deb) | Linux (rpm) | Linux (AppImage) ⬆️ | MacOS (dmg) ⬆️ | MacOS (app) ⬆️ |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| x86_64 | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64_en-US_windows.msi) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64-setup_windows.exe) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_amd64_linux.deb) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP-<version>-1.x86_64_linux.rpm) | 🚫 [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_amd64_linux.AppImage) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64_darwin.dmg) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_darwin_x64.app.tar.gz) |
| ARM64 | N/A | 🪟 [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64-setup_windows.exe) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_arm64_linux.deb) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP-<version>-1.aarch64_linux.rpm) | N/A | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_aarch64_darwin.dmg) | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_darwin_aarch64.app.tar.gz) |

> ⬆️ icon indicates this packaging format supports in-built app-updater

> 🪟 Windows x86_64 binary also works on ARM64 (Windows on ARM) devices with emulation (Not planning to release native Windows ARM64 build anytime soon as, x86_64 one works fine on ARM64 without noticeable performance impact)

> 🚫 Linux AppImage builds are experimental and does not support neodlp's browser intergration features due to it's sandboxed nature. Also, don't run the AppImage with portable (.home, .config) folders, it will break things (it is highly recommended to use native [deb, rpm, AUR] builds if possible for the full experiance, otherwise AppImages are good for trying out NeoDLP without installing)

> ⚠️ MacOS ARM64 binary downloads are experimental and may not open on Apple Silicon Macs if downloaded from browser (You will get 'Damaged File' error) it's because the binaries are not signed (signing MacOS binaries requires 99$/year Apple Developer Account subscription, which I can't afford RN!) and Apple Silicon Macs don't allow unsigned apps (downloaded from browser) to be installed on the system. If you want to use NeoDLP on your Apple Silicon Macs, There are few ways you can bypass these restrictions:
> 1. Using our automated [Curl-Bash Installer](https://neodlp.neosubhamoy.com/download) (Recommended)
> 2. You can also manually remove the .dmg file/.app folder from macOS quarantine using these commands: `xattr -d com.apple.quarantine NeoDLP_x.x.x_aarch64_darwin.dmg` (for .dmg file) -OR- `xattr -r -d com.apple.quarantine /Applications/NeoDLP.app` (for .app folder)
> 3. Or you can [compile NeoDLP from source](https://github.com/neosubhamoy/neodlp?tab=readme-ov-file#%EF%B8%8F-building-from-source) in your Mac (Then you don't have to download the pre-compiled binaries at all, though it is a much longer process and is intended for advanced users only)
