const parseUrl = (value) => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch (error) {
    return null;
  }
};

const hostMatches = (hostname, allowedHosts) =>
  allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );

const isSpotifyUrl = (value) => {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  return hostMatches(parsed.hostname.toLowerCase(), ['spotify.com']);
};

const isYoutubeUrl = (value) => {
  const parsed = parseUrl(value);
  if (!parsed) return false;
  return hostMatches(parsed.hostname.toLowerCase(), ['youtube.com', 'youtu.be']);
};

module.exports = {
  parseUrl,
  isSpotifyUrl,
  isYoutubeUrl,
};
