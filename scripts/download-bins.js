import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const downloadDir = path.join(projectRoot, 'src-tauri', 'resources', 'downloads');
const binDir = path.join(projectRoot, 'src-tauri', 'binaries');

const platform = os.platform();
const targetPlatform = process.argv[2];
const targetBin = process.argv[3];

const versions = {
    'yt-dlp': 'latest',
    'ffmpeg-ffprobe': 'latest',
    'deno': 'latest',
    'aria2c': '1.37.0',
};

const binaries = {
    'yt-dlp': [
        {
            name: 'yt-dlp-x86_64-pc-windows-msvc',
            platform: 'win32',
            url: `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases${versions['yt-dlp'] === 'latest' ? '/latest' : ''}/download${versions['yt-dlp'] !== 'latest' ? '/'+versions['yt-dlp'] : ''}/yt-dlp.exe`,
            src: path.join(downloadDir, 'yt-dlp-x86_64-pc-windows-msvc.exe'),
            dest: [
                path.join(binDir, 'yt-dlp-x86_64-pc-windows-msvc.exe')
            ],
            archive: null,
            cleanup: [
                path.join(downloadDir, 'yt-dlp-x86_64-pc-windows-msvc.exe')
            ]
        },
        {
            name: 'yt-dlp-x86_64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases${versions['yt-dlp'] === 'latest' ? '/latest' : ''}/download${versions['yt-dlp'] !== 'latest' ? '/'+versions['yt-dlp'] : ''}/yt-dlp_linux`,
            src: path.join(downloadDir, 'yt-dlp-x86_64-unknown-linux-gnu'),
            dest: [
                path.join(binDir, 'yt-dlp-x86_64-unknown-linux-gnu')
            ],
            archive: null,
            cleanup: [
                path.join(downloadDir, 'yt-dlp-x86_64-unknown-linux-gnu')
            ]
        },
        {
            name: 'yt-dlp-aarch64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases${versions['yt-dlp'] === 'latest' ? '/latest' : ''}/download${versions['yt-dlp'] !== 'latest' ? '/'+versions['yt-dlp'] : ''}/yt-dlp_linux_aarch64`,
            src: path.join(downloadDir, 'yt-dlp-aarch64-unknown-linux-gnu'),
            dest: [
                path.join(binDir, 'yt-dlp-aarch64-unknown-linux-gnu')
            ],
            archive: null,
            cleanup: [
                path.join(downloadDir, 'yt-dlp-aarch64-unknown-linux-gnu')
            ]
        },
        {
            name: 'yt-dlp-universal-apple-darwin',
            platform: 'darwin',
            url: `https://github.com/yt-dlp/yt-dlp-nightly-builds/releases${versions['yt-dlp'] === 'latest' ? '/latest' : ''}/download${versions['yt-dlp'] !== 'latest' ? '/'+versions['yt-dlp'] : ''}/yt-dlp_macos`,
            src: path.join(downloadDir, 'yt-dlp-universal-apple-darwin'),
            dest: [
                path.join(binDir, 'yt-dlp-x86_64-apple-darwin'),
                path.join(binDir, 'yt-dlp-aarch64-apple-darwin')
            ],
            archive: null,
            cleanup: [
                path.join(downloadDir, 'yt-dlp-universal-apple-darwin')
            ]
        },
    ],
    'ffmpeg-ffprobe': [
        {
            name: 'ffmpeg-ffprobe-x86_64-pc-windows-msvc',
            platform: 'win32',
            url: `https://github.com/yt-dlp/FFmpeg-Builds/releases${versions['ffmpeg-ffprobe'] === 'latest' ? '/latest' : ''}/download${versions['ffmpeg-ffprobe'] !== 'latest' ? '/'+versions['ffmpeg-ffprobe'] : ''}/ffmpeg-master-latest-win64-gpl.zip`,
            src: path.join(downloadDir, 'ffmpeg-master-latest-win64-gpl.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'ffmpeg-master-latest-win64-gpl', 'bin', 'ffmpeg.exe'),
                    path.join(downloadDir, 'ffmpeg-master-latest-win64-gpl', 'bin', 'ffprobe.exe')
                ],
                binDest: [
                    path.join(binDir, 'ffmpeg-x86_64-pc-windows-msvc.exe'),
                    path.join(binDir, 'ffprobe-x86_64-pc-windows-msvc.exe')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'ffmpeg-master-latest-win64-gpl.zip'),
                path.join(downloadDir, 'ffmpeg-master-latest-win64-gpl')
            ]
        },
        {
            name: 'ffmpeg-ffprobe-x86_64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/yt-dlp/FFmpeg-Builds/releases${versions['ffmpeg-ffprobe'] === 'latest' ? '/latest' : ''}/download${versions['ffmpeg-ffprobe'] !== 'latest' ? '/'+versions['ffmpeg-ffprobe'] : ''}/ffmpeg-master-latest-linux64-gpl.tar.xz`,
            src: path.join(downloadDir, 'ffmpeg-master-latest-linux64-gpl.tar.xz'),
            dest: null,
            archive: {
                type: 'tar.xz',
                binSrc: [
                    path.join(downloadDir, 'ffmpeg-master-latest-linux64-gpl', 'bin', 'ffmpeg'),
                    path.join(downloadDir, 'ffmpeg-master-latest-linux64-gpl', 'bin', 'ffprobe')
                ],
                binDest: [
                    path.join(binDir, 'ffmpeg-x86_64-unknown-linux-gnu'),
                    path.join(binDir, 'ffprobe-x86_64-unknown-linux-gnu')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'ffmpeg-master-latest-linux64-gpl.tar.xz'),
                path.join(downloadDir, 'ffmpeg-master-latest-linux64-gpl')
            ]
        },
        {
            name: 'ffmpeg-ffprobe-aarch64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/yt-dlp/FFmpeg-Builds/releases${versions['ffmpeg-ffprobe'] === 'latest' ? '/latest' : ''}/download${versions['ffmpeg-ffprobe'] !== 'latest' ? '/'+versions['ffmpeg-ffprobe'] : ''}/ffmpeg-master-latest-linuxarm64-gpl.tar.xz`,
            src: path.join(downloadDir, 'ffmpeg-master-latest-linuxarm64-gpl.tar.xz'),
            dest: null,
            archive: {
                type: 'tar.xz',
                binSrc: [
                    path.join(downloadDir, 'ffmpeg-master-latest-linuxarm64-gpl', 'bin', 'ffmpeg'),
                    path.join(downloadDir, 'ffmpeg-master-latest-linuxarm64-gpl', 'bin', 'ffprobe')
                ],
                binDest: [
                    path.join(binDir, 'ffmpeg-aarch64-unknown-linux-gnu'),
                    path.join(binDir, 'ffprobe-aarch64-unknown-linux-gnu')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'ffmpeg-master-latest-linuxarm64-gpl.tar.xz'),
                path.join(downloadDir, 'ffmpeg-master-latest-linuxarm64-gpl')
            ]
        },
        {
            name: 'ffmpeg-universal-apple-darwin',
            platform: 'darwin',
            url: `https://evermeet.cx/ffmpeg/get/zip`,
            src: path.join(downloadDir, 'ffmpeg-universal-apple-darwin.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'ffmpeg'),
                    path.join(downloadDir, 'ffmpeg')
                ],
                binDest: [
                    path.join(binDir, 'ffmpeg-x86_64-apple-darwin'),
                    path.join(binDir, 'ffmpeg-aarch64-apple-darwin')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'ffmpeg-universal-apple-darwin.zip'),
                path.join(downloadDir, 'ffmpeg')
            ]
        },
        {
            name: 'ffprobe-universal-apple-darwin',
            platform: 'darwin',
            url: `https://evermeet.cx/ffmpeg/get/ffprobe/zip`,
            src: path.join(downloadDir, 'ffprobe-universal-apple-darwin.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'ffprobe'),
                    path.join(downloadDir, 'ffprobe')
                ],
                binDest: [
                    path.join(binDir, 'ffprobe-x86_64-apple-darwin'),
                    path.join(binDir, 'ffprobe-aarch64-apple-darwin')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'ffprobe-universal-apple-darwin.zip'),
                path.join(downloadDir, 'ffprobe')
            ]
        }
    ],
    'deno': [
        {
            name: 'deno-x86_64-pc-windows-msvc',
            platform: 'win32',
            url: `https://github.com/denoland/deno/releases${versions['deno'] === 'latest' ? '/latest' : ''}/download${versions['deno'] !== 'latest' ? '/'+versions['deno'] : ''}/deno-x86_64-pc-windows-msvc.zip`,
            src: path.join(downloadDir, 'deno-x86_64-pc-windows-msvc.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'deno.exe')
                ],
                binDest: [
                    path.join(binDir, 'deno-x86_64-pc-windows-msvc.exe')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'deno-x86_64-pc-windows-msvc.zip'),
                path.join(downloadDir, 'deno.exe')
            ]
        },
        {
            name: 'deno-x86_64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/denoland/deno/releases${versions['deno'] === 'latest' ? '/latest' : ''}/download${versions['deno'] !== 'latest' ? '/'+versions['deno'] : ''}/deno-x86_64-unknown-linux-gnu.zip`,
            src: path.join(downloadDir, 'deno-x86_64-unknown-linux-gnu.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'deno')
                ],
                binDest: [
                    path.join(binDir, 'deno-x86_64-unknown-linux-gnu')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'deno-x86_64-unknown-linux-gnu.zip'),
                path.join(downloadDir, 'deno')
            ]
        },
        {
            name: 'deno-aarch64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/denoland/deno/releases${versions['deno'] === 'latest' ? '/latest' : ''}/download${versions['deno'] !== 'latest' ? '/'+versions['deno'] : ''}/deno-aarch64-unknown-linux-gnu.zip`,
            src: path.join(downloadDir, 'deno-aarch64-unknown-linux-gnu.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'deno')
                ],
                binDest: [
                    path.join(binDir, 'deno-aarch64-unknown-linux-gnu')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'deno-aarch64-unknown-linux-gnu.zip'),
                path.join(downloadDir, 'deno')
            ]
        },
        {
            name: 'deno-x86_64-apple-darwin',
            platform: 'darwin',
            url: `https://github.com/denoland/deno/releases${versions['deno'] === 'latest' ? '/latest' : ''}/download${versions['deno'] !== 'latest' ? '/'+versions['deno'] : ''}/deno-x86_64-apple-darwin.zip`,
            src: path.join(downloadDir, 'deno-x86_64-apple-darwin.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'deno')
                ],
                binDest: [
                    path.join(binDir, 'deno-x86_64-apple-darwin')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'deno-x86_64-apple-darwin.zip'),
                path.join(downloadDir, 'deno')
            ]
        },
        {
            name: 'deno-aarch64-apple-darwin',
            platform: 'darwin',
            url: `https://github.com/denoland/deno/releases${versions['deno'] === 'latest' ? '/latest' : ''}/download${versions['deno'] !== 'latest' ? '/'+versions['deno'] : ''}/deno-aarch64-apple-darwin.zip`,
            src: path.join(downloadDir, 'deno-aarch64-apple-darwin.zip'),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, 'deno')
                ],
                binDest: [
                    path.join(binDir, 'deno-aarch64-apple-darwin')
                ]
            },
            cleanup: [
                path.join(downloadDir, 'deno-aarch64-apple-darwin.zip'),
                path.join(downloadDir, 'deno')
            ]
        }
    ],
    'aria2c': [
        {
            name: 'aria2c-x86_64-pc-windows-msvc',
            platform: 'win32',
            url: `https://github.com/aria2/aria2/releases/download/release-${versions['aria2c']}/aria2-${versions['aria2c']}-win-64bit-build1.zip`,
            src: path.join(downloadDir, `aria2-${versions['aria2c']}-win-64bit-build1.zip`),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, `aria2-${versions['aria2c']}-win-64bit-build1`, 'aria2c.exe')
                ],
                binDest: [
                    path.join(binDir, 'aria2c-x86_64-pc-windows-msvc.exe')
                ]
            },
            cleanup: [
                path.join(downloadDir, `aria2-${versions['aria2c']}-win-64bit-build1.zip`),
                path.join(downloadDir, `aria2-${versions['aria2c']}-win-64bit-build1`)
            ]
        },
        {
            name: 'aria2c-x86_64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/asdo92/aria2-static-builds/releases/download/v${versions['aria2c']}/aria2-${versions['aria2c']}-linux-gnu-64bit-build1.tar.bz2`,
            src: path.join(downloadDir, `aria2-${versions['aria2c']}-linux-gnu-64bit-build1.tar.bz2`),
            dest: null,
            archive: {
                type: 'tar.bz2',
                binSrc: [
                    path.join(downloadDir, `aria2-${versions['aria2c']}-linux-gnu-64bit-build1`, 'aria2c')
                ],
                binDest: [
                    path.join(binDir, 'aria2c-x86_64-unknown-linux-gnu')
                ]
            },
            cleanup: [
                path.join(downloadDir, `aria2-${versions['aria2c']}-linux-gnu-64bit-build1.tar.bz2`),
                path.join(downloadDir, `aria2-${versions['aria2c']}-linux-gnu-64bit-build1`)
            ]
        },
        {
            name: 'aria2c-aarch64-unknown-linux-gnu',
            platform: 'linux',
            url: `https://github.com/aria2/aria2/releases/download/release-${versions['aria2c']}/aria2-${versions['aria2c']}-aarch64-linux-android-build1.zip`,
            src: path.join(downloadDir, `aria2-${versions['aria2c']}-aarch64-linux-android-build1.zip`),
            dest: null,
            archive: {
                type: 'zip',
                binSrc: [
                    path.join(downloadDir, `aria2-${versions['aria2c']}-aarch64-linux-android-build1`, 'aria2c')
                ],
                binDest: [
                    path.join(binDir, 'aria2c-aarch64-unknown-linux-gnu')
                ]
            },
            cleanup: [
                path.join(downloadDir, `aria2-${versions['aria2c']}-aarch64-linux-android-build1.zip`),
                path.join(downloadDir, `aria2-${versions['aria2c']}-aarch64-linux-android-build1`)
            ]
        }
    ]
}


function downloadAndProcess(bin) {
    console.log(`=> Processing: ${bin.name}`);
    console.log(`Downloading: ${bin.url}`);
    if (platform === 'win32') {
        execSync(`powershell -Command "Invoke-WebRequest -Uri '${bin.url}' -OutFile '${bin.src}'"`, { stdio: 'inherit' });
    } else {
        execSync(`curl -L "${bin.url}" -o "${bin.src}"`, { stdio: 'inherit' });
    }

    if (bin.archive) {
        console.log(`Extracting: ${bin.src}`);
        if (platform === 'win32' && bin.archive.type === 'zip') {
            execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${bin.src}', '${downloadDir}')"`, { stdio: 'inherit' });
        } else if (bin.archive.type === 'tar.bz2') {
            execSync(`tar -xjf "${bin.src}" -C "${downloadDir}"`, { stdio: 'inherit' });
        } else if (bin.archive.type === 'zip') {
            execSync(`unzip -o "${bin.src}" -d "${downloadDir}"`, { stdio: 'inherit' });
        } else {
            execSync(`tar -xf "${bin.src}" -C "${downloadDir}"`, { stdio: 'inherit' });
        }

        bin.archive.binSrc.forEach((src, index) => {
            const dest = bin.archive.binDest[index];
            console.log(`Moving: "${src}" to "${dest}"`);
            fs.copyFileSync(src, dest);
            if (platform !== 'win32') {
                fs.chmodSync(dest, 0o755);
            }
        });
    } else if (bin.dest) {
        bin.dest.forEach((dest) => {
            console.log(`Moving: "${bin.src}" to "${dest}"`);
            fs.copyFileSync(bin.src, dest);
            if (platform !== 'win32') {
                fs.chmodSync(dest, 0o755);
            }
        });
    }

    bin.cleanup.forEach((item) => {
        if (fs.existsSync(item)) {
            console.log(`Cleaning: "${item}"`);
            const stats = fs.statSync(item);
            if (stats.isDirectory()) {
                fs.rmSync(item, { recursive: true, force: true });
            } else {
                fs.unlinkSync(item);
            }
        }
    });
}


if (targetPlatform && !['win32', 'linux', 'darwin', 'all'].includes(targetPlatform)) {
    console.error(`ERROR: Invalid platform specified: '${targetPlatform}'. Use one of: win32, linux, darwin, or all`);
    process.exit(1);
}

if (targetBin && !binaries.hasOwnProperty(targetBin) && targetBin !== 'all') {
    console.error(`ERROR: Invalid binary specified: '${targetBin}'. Use one of: ${Object.keys(binaries).join(', ')}, or all`);
    process.exit(1);
}

const effectivePlatform = targetPlatform || platform;
const effectiveBin = targetBin || 'all';

console.log(`RUNNING: 📦 Binary Downloader (platform: ${effectivePlatform} | binary: ${effectiveBin})`);

Object.keys(binaries).forEach((binKey) => {
    if (effectiveBin !== 'all' && binKey !== effectiveBin) {
        return;
    }

    binaries[binKey].forEach((bin) => {
        if (effectivePlatform !== 'all' && bin.platform !== effectivePlatform) {
            return;
        }

        downloadAndProcess(bin);
    });
});

console.log('✅ Downloads Completed');
