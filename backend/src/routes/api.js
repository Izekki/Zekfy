const express = require('express');

const playlistController = require('../controllers/playlistController');
const songController = require('../controllers/songController');

const router = express.Router();

router.get('/playlists', playlistController.listPlaylists);
router.post('/playlists', playlistController.createPlaylist);
router.post('/playlists/:id/songs', playlistController.addSongToPlaylist);
router.post('/playlist/import', playlistController.importPlaylist);
router.get('/songs', songController.listSongs);
router.get('/songs/:id/stream', songController.streamSong);
router.post('/songs/resolve', songController.resolveInput);
router.post('/youtube/search', songController.searchYoutube);
router.post('/download/single', songController.downloadSingle);
router.delete('/songs/:id', songController.deleteSong);

module.exports = router;
