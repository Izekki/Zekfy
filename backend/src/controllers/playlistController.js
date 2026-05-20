const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');

const prisma = require('../utils/db');
const { downloadAndConvertToOpus, runWithConcurrency, projectRoot } = require('../services/downloadService');
const spotifyService = require('../services/spotifyService');
const youtubeService = require('../services/youtubeService');
const { isSpotifyUrl, isYoutubeUrl } = require('../utils/url');

const detectSource = (url) => {
  if (isSpotifyUrl(url)) {
    return 'spotify';
  }
  if (isYoutubeUrl(url)) {
    return 'youtube';
  }
  return null;
};

const ensureUniqueTrack = async ({ sourceId }) => {
  if (!sourceId) return null;
  return prisma.song.findFirst({
    where: {
      sourceId,
    },
  });
};

const resolveLocalPath = (relativePath) => {
  if (!relativePath) return null;
  return path.isAbsolute(relativePath)
    ? relativePath
    : path.join(projectRoot, relativePath);
};

const importPlaylist = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Se requiere una URL de playlist.' });
  }

  const source = detectSource(url);
  if (!source) {
    return res
      .status(400)
      .json({ error: 'La URL debe ser de Spotify o YouTube.' });
  }

  try {
    const playlistData =
      source === 'spotify'
        ? await spotifyService.getPlaylistTracks(url)
        : await youtubeService.getPlaylistTracks(url);

    const playlist = await prisma.playlist.create({
      data: {
        name: playlistData.name,
        externalUrl: url,
      },
    });

    const concurrency = Math.max(
      1,
      Number.parseInt(process.env.DOWNLOAD_CONCURRENCY || '2', 10) || 2,
    );

    const settledResults = await runWithConcurrency(
      playlistData.tracks,
      concurrency,
      async (track) => {
        const baseData = {
          title: track.title,
          artist: track.artist || 'Unknown Artist',
          duration: track.duration || 0,
          sourceId: track.sourceId || null,
        };

        let youtubeUrl = track.url;
        if (source === 'spotify') {
          const query = `${baseData.title} ${baseData.artist}`.trim();
          youtubeUrl = await youtubeService.searchTrack(query);
        }

        if (!youtubeUrl) {
          throw new Error('No se encontró URL para descargar.');
        }

        const existing = await ensureUniqueTrack(baseData);
        if (existing) {
          const existingPath = resolveLocalPath(existing.localPath);
          if (existingPath && (await fs.pathExists(existingPath))) {
            await prisma.playlistOnSong.create({
              data: {
                songId: existing.id,
                playlistId: playlist.id,
              },
            });
            return { status: 'skipped', songId: existing.id, title: existing.title };
          }
        }

        const songId = crypto.randomUUID();
        const download = await downloadAndConvertToOpus(youtubeUrl, songId);
        const localPath = path.relative(projectRoot, download.finalPath);
        const duration = download.duration || baseData.duration || 0;

        const song = await prisma.song.create({
          data: {
            id: songId,
            title: baseData.title,
            artist: baseData.artist,
            duration,
            localPath,
            source,
            sourceId: baseData.sourceId,
            sizeBytes: download.sizeBytes,
            bitrate: download.bitrate,
          },
        });

        await prisma.playlistOnSong.create({
          data: {
            songId: song.id,
            playlistId: playlist.id,
          },
        });

        return { status: 'downloaded', songId: song.id, title: song.title };
      },
    );

    const downloaded = [];
    const skipped = [];
    const failed = [];

    settledResults.forEach((result, index) => {
      const track = playlistData.tracks[index];
      if (result.status === 'fulfilled') {
        if (result.value.status === 'downloaded') {
          downloaded.push(result.value);
        } else {
          skipped.push(result.value);
        }
      } else {
        failed.push({
          title: track?.title || 'Unknown',
          error: result.reason?.message || 'Error desconocido',
        });
      }
    });

    return res.json({
      playlistId: playlist.id,
      name: playlist.name,
      counts: {
        downloaded: downloaded.length,
        skipped: skipped.length,
        failed: failed.length,
      },
      downloaded,
      skipped,
      failed,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  importPlaylist,
};
