import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define array of binary source directories
const binSrcDirs = [
    path.join(__dirname, 'src-tauri', 'binaries'),
    path.join(__dirname, 'src-tauri', 'resources', 'binaries'),
];

function makeFilesExecutable() {
    let totalCount = 0;
    let successDirs = 0;

    for (const binSrc of binSrcDirs) {
        try {
            if (!fs.existsSync(binSrc)) {
                console.error(`Binaries directory does not exist: ${binSrc}`);
                continue;
            }

            const files = fs.readdirSync(binSrc);
            const nonExeFiles = files.filter(file => !file.endsWith('.exe'));
            let count = 0;

            for (const file of nonExeFiles) {
                const filePath = path.join(binSrc, file);
                if (fs.statSync(filePath).isFile()) {
                    execSync(`chmod +x "${filePath}"`);
                    console.log(`Made executable: ${path.relative(__dirname, filePath)}`);
                    count++;
                }
            }
            
            console.log(`Successfully made ${count} files executable in ${binSrc}`);
            totalCount += count;
            successDirs++;
        } catch (error) {
            console.error(`Error processing directory ${binSrc}: ${error.message}`);
        }
    }

    console.log(`\nSummary: Made ${totalCount} files executable across ${successDirs} directories`);
}

console.log(`RUNNING: 🛠️ Build Script makeFilesExecutable.js`);
makeFilesExecutable();