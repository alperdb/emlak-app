const express   = require('express');
const path      = require('path');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // SPA + inline scripts/styles need this off
  crossOriginEmbedderPolicy: false,
}));

// ── CORS: sadece localhost ────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── Rate limiting: API'ye dakikada max 200 istek ──────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek. Lütfen bekleyin.' },
});
app.use('/api/', limiter);

// ── Body parser ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/listings',   require('./routes/listings'));
app.use('/api/customers',  require('./routes/customers'));
app.use('/api/tasks',      require('./routes/tasks'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/pipeline',   require('./routes/pipeline'));
app.use('/api/showings',   require('./routes/showings'));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n✅  Emlak Ofisi Yönetim Uygulaması çalışıyor');
  console.log(`🌐  Tarayıcıda açın: http://localhost:${PORT}\n`);
});
