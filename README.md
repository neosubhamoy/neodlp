# NeoDLP - (Neo Downloader Plus)

Crossplatform Video/Audio Downloader Desktop App with Modern UI and Browser Integration

[![status](https://img.shields.io/badge/status-active-brightgreen.svg?style=flat)](https://github.com/neosubhamoy/neodlp)
[![github tag](https://img.shields.io/github/v/tag/neosubhamoy/neodlp?color=yellow)](https://github.com/neosubhamoy/neodlp)
[![PRs](https://img.shields.io/badge/PRs-welcome-blue.svg?style=flat)](https://github.com/neosubhamoy/neodlp)

> **🥰 Liked this project? Please consider giving it a Star (🌟) on github to show us your appreciation and help the algorythm recommend this project to even more awesome people like you!**

### 💻 Supported Platforms
- Windows (10 / 11)
- Linux (Debian / Fedora / Arch Linux base)
- MacOS (>10.3)

### 🌐 Supported Sites

- All [Supported Sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) by [yt-dlp](https://github.com/yt-dlp/yt-dlp) **(2.5K+)**

### 🧩 External Dependencies

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The core CLI Tool used to download Video/Audio from the Web
- [FFmpeg](https://www.ffmpeg.org) - Used for Video/Audio Post-processing

### ⬇️ Download and Installation

1. Download the latest [NeoDLP](https://github.com/neosubhamoy/neodlp/releases/latest) release based on your OS and CPU Architecture then install it or install it directly from an available distribution channel

| Arch\OS | Windows | Linux | MacOS |
| :----        | :----   | :---- | :---- |
| x86_64 | ✅ [Download](https://github.com/neosubhamoy/neodlp/releases/latest) | ✅ [Download](https://github.com/neosubhamoy/neodlp/releases/latest) | ✅ [Download](https://github.com/neosubhamoy/neodlp/releases/latest) |
| ARM64 | ❌ N/A | ❌ N/A | ✅ [Download](https://github.com/neosubhamoy/neodlp/releases/latest) |

| Platform (OS) | Distribution Channel | Installation Command / Instruction |
| :---- | :---- | :---- |
| Windows x86_64 | WinGet | `winget install neodlp` |
| Linux x86_64 (Arch Linux) | AUR | `yay -S neodlp` |

### ⚡ Technologies Used

![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)
![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![ShadCnUi](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)

### 🛠️ Contributing / Building from Source

Want to be part of this? Feel free to contribute...!! Pull Requests are always welcome...!! (^_^) Follow these simple steps to start building:

* Make sure to install Rust, Node.js and Git before proceeding.
* Install Tauri [Prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS / platform
1. Fork this repo in your github account.
2. Git clone the forked repo in your local machine.
3. Install Node.js dependencies: `npm install`
4. Run development / build process
> ⚠️ Make sure to run the build command once before running the dev command for the first time to avoid build time errors
```code
npm run tauri dev      # for development
npm run tauri build      # for production build

# use these commands instead if you are using apple silicon macs
npm run tauri dev --config "./src-tauri/tauri.macos-aarch64.conf.json"
npm run tauri build --config "./src-tauri/tauri.macos-aarch64.conf.json"
```
5. Do the changes, Send a Pull Request with proper Description (NOTE: Pull Requests Without Proper Description will be Rejected)

**⭕ Noticed any Bugs or Want to give us some suggetions? Always feel free to open a GitHub Issue. We would love to hear from you...!!**

### 📝 License

NeoDLP is Licensed under the [MIT license](https://github.com/neosubhamoy/neodlp/blob/main/LICENSE). Anyone can view, modify, use (personal and commercial) or distribute it's sources without any attribution and extra permissions.