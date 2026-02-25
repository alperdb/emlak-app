const express = require('express');
const router  = express.Router();
const db      = require('../db');

const STAGES = ['lead','nitelikli','gosterim','teklif','pazarlik','kapandi','kaybedildi'];

// GET /api/pipeline  — tüm kayıtlar + müşteri/portföy adları
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*, c.name AS customer_name, c.phone AS customer_phone,
             l.title AS listing_title
      FROM   pipeline p
      LEFT JOIN customers c ON c.id = p.customer_id
      LEFT JOIN listings  l ON l.id = p.listing_id
      ORDER BY p.updated_at DESC
    `).all();

    // Aşama bazlı grupla
    const grouped = Object.fromEntries(STAGES.map(s => [s, []]));
    for (const r of rows) {
      const s = STAGES.includes(r.stage) ? r.stage : 'lead';
      grouped[s].push(r);
    }

    // KPI
    const kpi = {};
    for (const s of STAGES) kpi[s] = grouped[s].length;

    res.json({ stages: STAGES, grouped, kpi });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/pipeline
router.post('/', (req, res) => {
  try {
    const { title, stage, customer_id, listing_id, notes, value } = req.body;
    const r = db.prepare(`
      INSERT INTO pipeline (title, stage, customer_id, listing_id, notes, value)
      VALUES (?,?,?,?,?,?)
    `).run(title, stage || 'lead', customer_id||null, listing_id||null, notes||null, value||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/pipeline/:id/stage
router.patch('/:id/stage', (req, res) => {
  try {
    const { stage } = req.body;
    if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Geçersiz aşama' });
    db.prepare(`UPDATE pipeline SET stage=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(stage, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/pipeline/:id
router.put('/:id', (req, res) => {
  try {
    const { title, stage, customer_id, listing_id, notes, value } = req.body;
    db.prepare(`
      UPDATE pipeline SET title=?,stage=?,customer_id=?,listing_id=?,notes=?,value=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(title, stage, customer_id||null, listing_id||null, notes||null, value||null, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/pipeline/:id
router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM pipeline WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
