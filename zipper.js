/**
 * zipper.js
 * Compresses all Excel files in downloadDir into a dated zip archive.
 */

const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Zips all files in downloadDir into a single zip file in zipDir.
 * @param {string[]} filePaths - Array of file paths to include
 * @param {string} dateStr - Date string for naming (YYYY-MM-DD)
 * @returns {Promise<string>} - Path to the created zip file
 */
async function zipFiles(filePaths, dateStr) {
  const zipDir = path.resolve(process.env.ZIP_DIR || './exports');
  ensureDir(zipDir);

  const prefix = process.env.ZIP_PREFIX || 'transactions';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipName = `${prefix}_${dateStr}_${timestamp}.zip`;
  const zipPath = path.join(zipDir, zipName);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`[zipper] Created zip: ${zipPath} (${archive.pointer()} bytes)`);
      resolve(zipPath);
    });

    archive.on('error', reject);
    archive.pipe(output);

    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: path.basename(filePath) });
        console.log(`[zipper] Adding to zip: ${path.basename(filePath)}`);
      } else {
        console.warn(`[zipper] File not found, skipping: ${filePath}`);
      }
    }

    archive.finalize();
  });
}

/**
 * Zips all Excel/CSV files currently in the downloads directory.
 * @param {string} dateStr
 * @returns {Promise<string>} path to zip
 */
async function zipDownloadsDir(dateStr) {
  const downloadDir = path.resolve(process.env.DOWNLOAD_DIR || './downloads');
  if (!fs.existsSync(downloadDir)) {
    throw new Error(`Download directory not found: ${downloadDir}`);
  }

  const files = fs.readdirSync(downloadDir)
    .filter(f => /\.(xlsx|xls|csv)$/i.test(f))
    .map(f => path.join(downloadDir, f));

  if (files.length === 0) {
    throw new Error('No Excel/CSV files found in downloads directory');
  }

  console.log(`[zipper] Found ${files.length} file(s) to zip.`);
  return zipFiles(files, dateStr);
}

module.exports = { zipFiles, zipDownloadsDir };
