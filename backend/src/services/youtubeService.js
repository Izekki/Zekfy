const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const { isYoutubeUrl } = require('../utils/url');

const YOUTUBE_VIDEO_PREFIX = 'https://www.youtube.com/watch?v=';

const buildYoutubeUrl = (idOrUrl) => {
  if (!idOrUrl) return null;
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) {
    return idOrUrl;
  }
  return `${YOUTUBE_VIDEO_PREFIX}${idOrUrl}`;
};

const getPlaylistTracks = async (playlistUrl) => {
  const { stdout } = await execFileAsync('yt-dlp', ['-J', '--flat-playlist', playlistUrl]);
  const payload = JSON.parse(stdout);
  const entries = Array.isArray(payload.entries) ? payload.entries : [];

  const tracks = entries
    .map((entry) => ({
      title: entry.title || entry.id || 'Unknown track',
      url: buildYoutubeUrl(entry.url || entry.id),
      sourceId: entry.id || null,
      duration: entry.duration || null,
    }))
    .filter((track) => Boolean(track.url));

  return {
    name: payload.title || 'YouTube playlist',
    tracks,
  };
};

const searchTrack = async (query) => {
  const { stdout } = await execFileAsync('yt-dlp', [
    '--skip-download',
    '--get-id',
    `ytsearch1:${query}`,
  ]);
  const id = stdout.trim().split('\n')[0];
  if (!id) {
    throw new Error('No se encontró un resultado en YouTube.');
  }
  return buildYoutubeUrl(id);
};

module.exports = {
  getPlaylistTracks,
  searchTrack,
  isYoutubeUrl,
};
