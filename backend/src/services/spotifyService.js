const SpotifyWebApi = require('spotify-web-api-node');

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const spotifyApi = new SpotifyWebApi({
  clientId,
  clientSecret,
});

let cachedToken = null;
let tokenExpiresAt = 0;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

const ensureSpotifyConfig = () => {
  if (!clientId || !clientSecret) {
    throw new Error('Faltan SPOTIFY_CLIENT_ID o SPOTIFY_CLIENT_SECRET.');
  }
};

const ensureAccessToken = async () => {
  ensureSpotifyConfig();
  if (!cachedToken || Date.now() >= tokenExpiresAt) {
    const response = await spotifyApi.clientCredentialsGrant();
    cachedToken = response.body.access_token;
    tokenExpiresAt =
      Date.now() + response.body.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS;
    spotifyApi.setAccessToken(cachedToken);
  }
  return spotifyApi;
};

const extractIdFromUrl = (url, type) => {
  const match = url.match(new RegExp(`${type}/([a-zA-Z0-9]+)`));
  return match ? match[1] : null;
};

const getPlaylistTracks = async (playlistUrl) => {
  const playlistId = extractIdFromUrl(playlistUrl, 'playlist');
  if (!playlistId) {
    throw new Error('No se pudo extraer el ID de la playlist de Spotify.');
  }

  const api = await ensureAccessToken();
  const playlist = await api.getPlaylist(playlistId);
  const tracks = [];

  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await api.getPlaylistTracks(playlistId, { limit, offset });
    response.body.items.forEach((item) => {
      if (!item.track) return;
      const artists = item.track.artists?.map((artist) => artist.name).join(', ') || 'Unknown';
      tracks.push({
        title: item.track.name,
        artist: artists,
        duration: Math.round(item.track.duration_ms / 1000),
        sourceId: item.track.id,
      });
    });

    if (!response.body.next) {
      break;
    }
    offset += limit;
  }

  return {
    name: playlist.body.name || 'Spotify playlist',
    tracks,
  };
};

const getTrackFromUrl = async (trackUrl) => {
  const trackId = extractIdFromUrl(trackUrl, 'track');
  if (!trackId) {
    throw new Error('No se pudo extraer el ID del track de Spotify.');
  }
  const api = await ensureAccessToken();
  const track = await api.getTrack(trackId);
  const artists = track.body.artists?.map((artist) => artist.name).join(', ') || 'Unknown';
  return {
    title: track.body.name,
    artist: artists,
    duration: Math.round(track.body.duration_ms / 1000),
    sourceId: track.body.id,
  };
};

module.exports = {
  getPlaylistTracks,
  getTrackFromUrl,
};
