const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

const prisma = require('../utils/db');
const { downloadAndConvertToOpus, projectRoot } = require('../services/downloadService');
const { attachSongToPlaylists } = require('../services/playlistLinkService');
const spotifyService = require('../services/spotifyService');
const youtubeService = require('../services/youtubeService');

const resolveLocalPath = (relativePath) =>
  path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, relativePath);

const toPlaylistIds = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0))]
    : [];

const listSongs = async (_req, res) => {
  const songs = await prisma.song.findMany({
    include: {
      playlists: {
        include: {
          playlist: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(songs);
};

const streamSong = async (req, res) => {
  const song = await prisma.song.findUnique({
    where: { id: req.params.id },
  });

  if (!song) {
    return res.status(404).json({ error: 'Canción no encontrada.' });
  }

  const filePath = resolveLocalPath(song.localPath);
  if (!(await fs.pathExists(filePath))) {
    return res.status(404).json({ error: 'Archivo no disponible.' });
  }

  const stat = await fs.stat(filePath);
  res.setHeader('Content-Type', 'audio/ogg');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => res.sendStatus(500));
  return stream.pipe(res);
};

const resolveTrackPayload = async (payload) => {
  const { url, title, artist, sourceId, thumbnail } = payload;

  if (url && url.includes('spotify.com/track')) {
    const spotifyTrack = await spotifyService.getTrackFromUrl(url);
    const youtubeUrl = await youtubeService.searchTrack(
      `${spotifyTrack.title} ${spotifyTrack.artist}`,
    );

    if (!youtubeUrl) {
      throw new Error('No se encontró resultado en YouTube.');
    }

    return {
      source: 'spotify',
      youtubeUrl,
      track: {
        ...spotifyTrack,
        sourceUrl: youtubeUrl,
        thumbnail: thumbnail || null,
      },
    };
  }

  if (url && youtubeService.isYoutubeUrl(url)) {
    const metadata = await youtubeService.getTrackMetadata(url);
    return {
      source: 'youtube',
      youtubeUrl: metadata.url,
      track: {
        title: title || metadata.title,
        artist: artist || metadata.artist,
        duration: metadata.duration,
        sourceId: sourceId || metadata.sourceId,
        sourceUrl: metadata.url,
        thumbnail: thumbnail || metadata.thumbnail,
      },
    };
  }

  const query = url || `${title || ''} ${artist || ''}`.trim();
  const [result] = await youtubeService.searchTracks(query, 1);
  return {
    source: 'youtube',
    youtubeUrl: result.url,
    track: {
      title: title || result.title,
      artist: artist || result.artist,
      duration: result.duration,
      sourceId: sourceId || result.sourceId,
      sourceUrl: result.url,
      thumbnail: thumbnail || result.thumbnail,
    },
  };
};

const resolveInput = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Se requiere una URL para resolver datos.' });
  }

  try {
    if (url.includes('spotify.com/track')) {
      const track = await spotifyService.getTrackFromUrl(url);
      return res.json({
        source: 'spotify',
        track,
      });
    }

    if (!youtubeService.isYoutubeUrl(url)) {
      return res.status(400).json({ error: 'La URL debe ser de Spotify o YouTube.' });
    }

    const track = await youtubeService.getTrackMetadata(url);
    return res.json({
      source: 'youtube',
      track,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const searchYoutube = async (req, res) => {
  const { query, limit } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Escribe una búsqueda para consultar YouTube.' });
  }

  try {
    const results = await youtubeService.searchTracks(query.trim(), limit);
    return res.json({ results });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const downloadSingle = async (req, res) => {
  const { url, title, artist } = req.body;
  const playlistIds = toPlaylistIds(req.body.playlistIds);

  if (!url && !title && !artist) {
    return res.status(400).json({
      error: 'Proporciona una URL de YouTube o el título y artista.',
    });
  }

  try {
    const { source, youtubeUrl, track } = await resolveTrackPayload(req.body);

    if (!youtubeUrl) {
      throw new Error('No se pudo resolver la URL de YouTube.');
    }

    if (track.sourceId) {
      const existing = await prisma.song.findFirst({
        where: { sourceId: track.sourceId },
      });
      if (existing) {
        await attachSongToPlaylists(existing.id, playlistIds);
        return res.json({ status: 'existing', song: existing });
      }
    }

    const songId = crypto.randomUUID();
    const download = await downloadAndConvertToOpus(youtubeUrl, songId);
    const localPath = path.relative(projectRoot, download.finalPath);
    const duration = download.duration || track.duration || 0;

    const song = await prisma.song.create({
      data: {
        id: songId,
        title: track.title,
        artist: track.artist,
        duration,
        localPath,
        source,
        sourceId: track.sourceId,
        sourceUrl: track.sourceUrl || youtubeUrl,
        thumbnail: track.thumbnail,
        sizeBytes: download.sizeBytes,
        bitrate: download.bitrate,
      },
    });

    await attachSongToPlaylists(song.id, playlistIds);

    return res.json({ status: 'downloaded', song });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deleteSong = async (req, res) => {
  const song = await prisma.song.findUnique({
    where: { id: req.params.id },
  });

  if (!song) {
    return res.status(404).json({ error: 'Canción no encontrada.' });
  }

  await prisma.playlistOnSong.deleteMany({
    where: { songId: song.id },
  });
  await prisma.song.delete({ where: { id: song.id } });

  const filePath = resolveLocalPath(song.localPath);
  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
  }

  return res.json({ status: 'deleted' });
};

module.exports = {
  listSongs,
  streamSong,
  resolveInput,
  searchYoutube,
  downloadSingle,
  deleteSong,
};
