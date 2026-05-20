require('dotenv').config();

const express = require('express');

const rateLimit = require('express-rate-limit');
const apiRoutes = require('./routes/api');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const maxRequests = Number.parseInt(process.env.RATE_LIMIT_MAX || '120', 10);
const limiter = rateLimit({
  windowMs,
  max: maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);
app.use('/api', apiRoutes);

app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Zekfy backend activo en http://localhost:${port}`);
});
