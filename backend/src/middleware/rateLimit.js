const createRateLimiter = ({ windowMs = 60_000, max = 120 } = {}) => {
  const store = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res
        .status(429)
        .json({ error: 'Demasiadas solicitudes, intenta más tarde.' });
    }

    entry.count += 1;
    store.set(key, entry);
    return next();
  };
};

module.exports = createRateLimiter;
