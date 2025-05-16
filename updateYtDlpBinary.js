import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(`RUNNING: 🛠️ Build Script updateYtDlpBinary.js`);

// Get the platform triple from command line arguments
const platformTriple = process.argv[2];

if (!platformTriple) {
  console.error('Error: Please provide a platform triple');
  process.exit(1);
}

// Define the binaries directory
const binariesDir = path.join(__dirname, 'src-tauri', 'binaries');

// Construct the binary filename based on platform triple
let binaryName = `yt-dlp-${platformTriple}`;
if (platformTriple === 'x86_64-pc-windows-msvc') {
  binaryName += '.exe';
}

// Full path to the binary
const binaryPath = path.join(binariesDir, binaryName);

// Check if binary exists
if (!fs.existsSync(binaryPath)) {
  console.error(`Error: Binary not found at: ${binaryPath}`);
  process.exit(1);
}

console.log(`Found binary at: ${binaryPath}`);

// Make binary executable if not on Windows
if (platformTriple !== 'x86_64-pc-windows-msvc') {
  console.log('Making binary executable...');
  fs.chmodSync(binaryPath, 0o755);
}

// Execute the update command
console.log(`Updating ${platformTriple} binary to latest nightly version...`);
execFile(binaryPath, ['--update-to', 'nightly'], (error, stdout, stderr) => {
  if (error) {
    console.error(`Error updating binary: ${error.message}`);
    if (stderr) console.error(stderr);
    process.exit(1);
  }
  
  console.log(`Update successful for ${platformTriple}:`);
  console.log(stdout);
});