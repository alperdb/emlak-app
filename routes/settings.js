const express = require('express');
const router  = express.Router();
const db      = require('../db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.mimetype);
    cb(null, ok);
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.get('/', (_req, res) => {
  const rows = db.prepare(`SELECT key, value FROM settings`).all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.put('/', (req, res) => {
  const upsert = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
  const run = db.transaction((data) => {
    for (const [k, v] of Object.entries(data)) upsert.run(k, String(v));
  });
  run(req.body);
  res.json({ ok: true });
});

router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geçersiz dosya' });
  const logoPath = `/uploads/${req.file.filename}`;
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('logo_path', ?)`).run(logoPath);
  res.json({ path: logoPath });
});

module.exports = router;
