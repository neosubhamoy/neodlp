### ✨ Changelog

- DOWNLOADER: Introduced 'Combine' download mode (Now, You can combine a video and audio stream of your choice)
- SETTINGS: Added global video/audio file format selection option (Available Formats: MP4, WEBM, MKV, M4A, OPUS, MP3)
- SETTINGS: Added video/audio file metadata embeding option
- SETTINGS: Added thumbnail embeding option in audio files (as cover art)
- SETTINGS: Added re-encode video over remuxing option (when file format convertion is needed)
- SETTINGS: Added strict downloadablity check option
- SETTINGS: Added download speed rate limit option
- SETTINGS: Added download max retries option
- SETTINGS: Added temporary download folder cleanup option
- UI: Improved 'Settings' ui/layout with categories (tabs)
- UI: Merged 'Extension' sidebar tab within 'Settings' (Settings > Extension > Install)
- UI: Improved 'Library' ui/layout with tabs
- UI: Added 'Stop' all ongoing downloads button in 'Library'
- UI: Renamed settings 'General' tab to 'Application' ('General' is now a sub-category of 'Application' tab)
- UI: Improved all alert dialog messages (for better undestanding/UX)
- FIXED: Unexpected crashing of yt-dlp causing downloads to stuck on a unrevocable state (Now, coresponding download will be 'paused' on detection of unexpected yt-dlp crash)
- FIXED: Broken app updater progress bar/percentage (also improved the update notification card)
- Lots of other minor fixes and improvements

### 📝 Notes

> ⚠️ Linux Users: Make sure yt-dlp is not installed in your distro (otherwise you will get package installation conflict). Don't worry, You can still use yt-dlp cli as before (the only difference is that now it will be installed and auto-updated by neo-dlp, which You can also disable from neo-dlp Settings if you don't want to auto-update yt-dlp)

> This is an Un-Signed Build (Windows doesn't trust this Certificate so, it may flag this as malicious software, in that case, disable Windows SmartScreen and Defender, install it, and then re-enable them)

> This is an Un-Signed Build (MacOS doesn't trust this Certificate so, it may flag this as from 'unverified developer' and prevent it from opening, in that case, open Settings and allow it from 'Settings > Privacy and Security' section to get started)

### ⬇️ Download Section

| Arch\OS | Windows (msi) ⬆️ | Windows (exe) ⬆️ | Linux (deb) | Linux (rpm) | MacOS (dmg) ⬆️ | MacOS (app) ⬆️ |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| x86_64 | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64_en-US.msi) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64-setup.exe) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_amd64.deb) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP-<version>-1.x86_64.rpm) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_x64.dmg) | [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_x64.app.tar.gz) |
| ARM64 | N/A | N/A | N/A | N/A | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_<version>_aarch64.dmg) | ⚠️ [Download](https://github.com/neosubhamoy/neodlp/releases/download/<release_tag>/NeoDLP_aarch64.app.tar.gz) |

> ⬆️ icon indicates this packaging format supports in-built app-updater

> ⚠️ MacOS ARM64 binary downloads are experimental and may not open on Apple Silicon Macs if downloaded from browser (You will get 'Damaged File' error) it's because the binaries are not signed (signing MacOS binaries requires 99$/year Apple Developer Account subscription, which I can't afford RN!) and Apple Silicon Macs don't allow unsigned apps (downloaded from browser) to be installed on the system. If you want to use NeoDLP on your Apple Silicon Macs, you can simply use the command line [Curl-Bash Installer](https://neodlp.neosubhamoy.com/download) (Recommended) -OR- [compile it from source](https://github.com/neosubhamoy/neodlp?tab=readme-ov-file#%EF%B8%8F-contributing--building-from-source) in your Mac