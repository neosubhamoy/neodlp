# NeoDLP Extension

NeoDLP (Neo Downloader Plus) Browser Integration

[![github release](https://img.shields.io/github/v/release/neosubhamoy/neodlp?color=lime-green&style=for-the-badge)](https://github.com/neosubhamoy/neodlp/releases/latest)
[![cws users](https://img.shields.io/chrome-web-store/users/mehopeailfjmiloiiohgicphlcgpompf?color=yellow&style=for-the-badge)](https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf)
[![github license](https://img.shields.io/github/license/neosubhamoy/neodlp?color=blue&style=for-the-badge)](https://github.com/neosubhamoy/neodlp/blob/main/extension/LICENSE)

> [!TIP]
> **🥰 Liked this project? Please consider giving it a Star (🌟) on github to show us your appreciation and help the algorythm recommend this project to even more awesome people like you!**

## Pre-Requirements

- [NeoDLP](https://github.com/neosubhamoy/neodlp) (Installed and Running)

## Download and Installation

### Direct Installation from Official Store Listing

[link-chrome]: https://chromewebstore.google.com/detail/neo-downloader-plus/mehopeailfjmiloiiohgicphlcgpompf "Version published on Chrome Web Store"
[link-firefox]: https://addons.mozilla.org/en-US/firefox/addon/neo-downloader-plus "Version published on Mozilla Add-ons"

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/chrome/chrome.svg" width="48" alt="Chrome" valign="middle">][link-chrome] [<img valign="middle" src="https://img.shields.io/chrome-web-store/v/mehopeailfjmiloiiohgicphlcgpompf.svg?label=%20">][link-chrome] also compatible with [<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/edge/edge.svg" width="24" alt="Edge" valign="middle">][link-chrome] [<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/opera/opera.svg" width="24" alt="Opera" valign="middle">][link-chrome]

[<img src="https://raw.githubusercontent.com/alrra/browser-logos/90fdf03c/src/firefox/firefox.svg" width="48" alt="Firefox" valign="middle">][link-firefox] [<img valign="middle" src="https://img.shields.io/amo/v/neo-downloader-plus.svg?label=%20">][link-firefox]

### Manual Installation (in Google Chrome / Chromium based browsers)

1. Download the `neodlp-extension-<version>-chrome.zip` file from the [latest release](https://github.com/neosubhamoy/neodlp/releases).
2. Extract the `.zip` file (using any zip extractor software. eg: 7zip, WinRAR etc.).
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Enable "Developer mode" in the top right corner.
5. Click on "Load unpacked" and select the newly extracted folder. Done! That's it...!!

### Manual Installation (in Mozilla Firefox)

1. Download the `neodlp-extension-<version>-firefox.zip` file from the [latest release](https://github.com/neosubhamoy/neodlp/releases).
2. Open Firefox and navigate to `about:addons`.
3. Click on the gear icon (top right) and select "Install Add-on From File...".
4. Select the downloaded `.zip` file. Done! That's it...!!

## Technologies Used

[![WXT](https://img.shields.io/badge/WXT-67D55E.svg?style=for-the-badge&logo=WXT&logoColor=white)](https://wxt.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![ShadCnUi](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)](https://ui.shadcn.com)

## Building from Source

Want to run/build NeoDLP Extension from the source code? Follow these simple steps:

* Make sure to install [Node.js](https://nodejs.org/en), and [Git](https://git-scm.com/downloads) before proceeding.
1. Clone this repo in your local machine: `git clone https://github.com/neosubhamoy/neodlp.git`
2. Go inside the cloned project directory: `cd neodlp/extension`
3. Install Node.js dependencies: `npm install`
4. Run development / build / zipping process
```code
npm run dev              # for development (chrome)
npm run dev:firefox      # for development (firefox)
npm run build            # for production build (chrome)
npm run build:firefox    # for production build (firefox)
npm run zip              # for production zip creation (chrome)
npm run zip:firefox      # for production zip creation (firefox)
```

## License

NeoDLP Extension is Licensed under the [MIT license](https://github.com/neosubhamoy/neodlp/blob/main/extension/LICENSE). Anyone can view, modify, use (personal and commercial) or distribute it's sources without any attribution and extra permissions.