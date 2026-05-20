const express = require('express');

const playlistController = require('../controllers/playlistController');
const songController = require('../controllers/songController');

const router = express.Router();

router.post('/playlist/import', playlistController.importPlaylist);
router.get('/songs', songController.listSongs);
router.get('/songs/:id/stream', songController.streamSong);
router.post('/download/single', songController.downloadSingle);
router.delete('/songs/:id', songController.deleteSong);

module.exports = router;
