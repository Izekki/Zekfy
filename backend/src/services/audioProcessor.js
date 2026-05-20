const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const convertToOpus = async (inputPath, outputPath) => {
  await execFileAsync('ffmpeg', [
    '-i',
    inputPath,
    '-c:a',
    'libopus',
    '-b:a',
    '64k',
    '-vbr',
    'on',
    '-application',
    'audio',
    outputPath,
    '-y',
  ]);
};

const getDurationSeconds = async (filePath) => {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? Math.round(duration) : 0;
  } catch (error) {
    return 0;
  }
};

module.exports = {
  convertToOpus,
  getDurationSeconds,
};
