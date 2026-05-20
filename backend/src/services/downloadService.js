const fs = require('fs-extra');
const path = require('path');

const { execFile } = require('child_process');
const { promisify } = require('util');
const { convertToOpus, getDurationSeconds } = require('./audioProcessor');

const execFileAsync = promisify(execFile);

const projectRoot = path.resolve(__dirname, '..', '..');
const tempDir = path.join(projectRoot, 'temp');
const downloadsDir = path.join(projectRoot, 'downloads');

const ensureDirs = async () => {
  await fs.ensureDir(tempDir);
  await fs.ensureDir(downloadsDir);
};

const downloadAndConvertToOpus = async (youtubeUrl, outputId) => {
  await ensureDirs();

  const tempTemplate = path.join(tempDir, `${outputId}.%(ext)s`);
  await execFileAsync('yt-dlp', ['-f', 'bestaudio', '-o', tempTemplate, youtubeUrl]);

  const tempFiles = await fs.readdir(tempDir);
  const tempFile = tempFiles.find((file) => file.startsWith(outputId));
  if (!tempFile) {
    throw new Error('No se generó archivo temporal.');
  }

  const tempPath = path.join(tempDir, tempFile);
  const finalPath = path.join(downloadsDir, `${outputId}.opus`);

  await convertToOpus(tempPath, finalPath);

  await fs.remove(tempPath);

  const stats = await fs.stat(finalPath);
  const duration = await getDurationSeconds(finalPath);

  return {
    finalPath,
    duration,
    sizeBytes: stats.size,
    bitrate: 64,
  };
};

const runWithConcurrency = async (items, limit, handler) => {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const task = Promise.resolve().then(() => handler(item));
    results.push(task);
    executing.add(task);

    const cleanup = () => executing.delete(task);
    task.then(cleanup, cleanup);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
};

module.exports = {
  downloadAndConvertToOpus,
  runWithConcurrency,
  projectRoot,
  downloadsDir,
};
