const prisma = require('../utils/db');

const attachSongToPlaylists = async (songId, playlistIds) => {
  const uniquePlaylistIds = [...new Set((playlistIds || []).filter(Boolean))];

  await Promise.all(
    uniquePlaylistIds.map(async (playlistId) => {
      const existingLink = await prisma.playlistOnSong.findUnique({
        where: {
          songId_playlistId: {
            songId,
            playlistId,
          },
        },
      });

      if (!existingLink) {
        await prisma.playlistOnSong.create({
          data: {
            songId,
            playlistId,
          },
        });
      }
    }),
  );
};

module.exports = {
  attachSongToPlaylists,
};
