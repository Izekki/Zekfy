const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

const prisma = require('../utils/db');
const { downloadAndConvertToOpus, projectRoot } = require('../services/downloadService');
const spotifyService = require('../services/spotifyService');
const youtubeService = require('../services/youtubeService');

const resolveLocalPath = (relativePath) =>
  path.isAbsolute(relativePath) ? relativePath : path.join(projectRoot, relativePath);

const extractYoutubeId = (url) => {
  if (!url) return null;
  if (url.includes('youtu.be/')) {
    return url.split('youtu.be/')[1]?.split('?')[0] || null;
  }
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
};

const listSongs = async (_req, res) => {
  const songs = await prisma.song.findMany({
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

const downloadSingle = async (req, res) => {
  const { url, title, artist } = req.body;

  if (!url && !title && !artist) {
    return res.status(400).json({
      error: 'Proporciona una URL de YouTube o el título y artista.',
    });
  }

  try {
    let track = {
      title: title || 'Unknown track',
      artist: artist || 'Unknown Artist',
      duration: 0,
      sourceId: null,
    };
    let youtubeUrl = null;
    let source = 'youtube';

    if (url && url.includes('spotify.com/track')) {
      track = await spotifyService.getTrackFromUrl(url);
      source = 'spotify';
      youtubeUrl = await youtubeService.searchTrack(
        `${track.title} ${track.artist}`,
      );
    } else if (url && youtubeService.isYoutubeUrl(url)) {
      youtubeUrl = url;
      track.sourceId = extractYoutubeId(url);
    } else {
      const query = url || `${track.title} ${track.artist}`.trim();
      youtubeUrl = await youtubeService.searchTrack(query);
    }

    if (!youtubeUrl) {
      throw new Error('No se pudo resolver la URL de YouTube.');
    }

    if (track.sourceId) {
      const existing = await prisma.song.findFirst({
        where: { sourceId: track.sourceId },
      });
      if (existing) {
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
        sizeBytes: download.sizeBytes,
        bitrate: download.bitrate,
      },
    });

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
  downloadSingle,
  deleteSong,
};
