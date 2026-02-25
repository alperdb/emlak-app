const express = require('express');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/listings',   require('./routes/listings'));
app.use('/api/customers',  require('./routes/customers'));
app.use('/api/tasks',      require('./routes/tasks'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/pipeline',   require('./routes/pipeline'));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n✅  Emlak Ofisi Yönetim Uygulaması çalışıyor');
  console.log(`🌐  Tarayıcıda açın: http://localhost:${PORT}\n`);
});
