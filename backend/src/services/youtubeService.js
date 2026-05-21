const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const { isYoutubeUrl } = require('../utils/url');

const YOUTUBE_VIDEO_PREFIX = 'https://www.youtube.com/watch?v=';
const DEFAULT_SEARCH_LIMIT = 5;
const MIN_SEARCH_LIMIT = 1;
const MAX_SEARCH_LIMIT = 10;

const buildYoutubeUrl = (idOrUrl) => {
  if (!idOrUrl) return null;
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) {
    return idOrUrl;
  }
  return `${YOUTUBE_VIDEO_PREFIX}${idOrUrl}`;
};

const normalizeText = (value, fallback) => {
  if (value == null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeTrack = (entry = {}) => ({
  title: normalizeText(entry.track || entry.title, 'Unknown track'),
  artist: normalizeText(
    entry.artist || entry.album_artist || entry.creator || entry.uploader || entry.channel,
    'Unknown artist',
  ),
  duration: Number.isFinite(entry.duration) ? Math.round(entry.duration) : 0,
  sourceId: entry.id || null,
  url: buildYoutubeUrl(entry.webpage_url || entry.original_url || entry.url || entry.id),
  thumbnail: entry.thumbnail || null,
});

const getPlaylistTracks = async (playlistUrl) => {
  let payload;
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '-J',
      '--flat-playlist',
      playlistUrl,
    ]);
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      'No se pudo obtener la playlist de YouTube. Verifica la URL y la instalación de yt-dlp.',
    );
  }
  const entries = Array.isArray(payload.entries) ? payload.entries : [];

  const tracks = entries
    .map((entry) => normalizeTrack(entry))
    .filter((track) => Boolean(track.url));

  return {
    name: payload.title || 'YouTube playlist',
    tracks,
  };
};

const getTrackMetadata = async (videoUrl) => {
  let payload;
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '-J',
      '--no-playlist',
      '--skip-download',
      videoUrl,
    ]);
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      'No se pudo leer la URL de YouTube. Verifica la URL y la instalación de yt-dlp.',
    );
  }
  const track = normalizeTrack(payload);
  if (!track.url) {
    throw new Error('No se pudo resolver la canción desde YouTube.');
  }
  return track;
};

const searchTracks = async (query, limit = DEFAULT_SEARCH_LIMIT) => {
  let payload;
  const safeLimit = Math.min(
    Math.max(Number(limit) || DEFAULT_SEARCH_LIMIT, MIN_SEARCH_LIMIT),
    MAX_SEARCH_LIMIT,
  );
  try {
    const { stdout } = await execFileAsync('yt-dlp', [
      '-J',
      '--flat-playlist',
      `ytsearch${safeLimit}:${query}`,
    ]);
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      'No se pudo buscar en YouTube. Verifica la instalación de yt-dlp.',
    );
  }

  const results = Array.isArray(payload.entries)
    ? payload.entries.map((entry) => normalizeTrack(entry)).filter((track) => Boolean(track.url))
    : [];

  if (results.length === 0) {
    throw new Error('No se encontraron resultados en YouTube.');
  }

  return results;
};

const searchTrack = async (query) => {
  const [result] = await searchTracks(query, MIN_SEARCH_LIMIT);
  return result.url;
};

module.exports = {
  getPlaylistTracks,
  getTrackMetadata,
  searchTracks,
  searchTrack,
  isYoutubeUrl,
};
