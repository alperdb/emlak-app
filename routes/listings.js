const express = require('express');
const router  = express.Router();
const db      = require('../db');

const ALL_FIELDS = [
  'title','type','property_type','room_count','gross_sqm','net_sqm',
  'floor_number','total_floors','building_age','heating_type',
  'is_furnished','is_in_site','facing','deed_status','occupancy_status',
  'province','district','neighborhood','address',
  'price','monthly_dues','deposit','description','internal_notes','status'
];
const BOOL_FIELDS = new Set(['is_furnished','is_in_site']);

function pick(body) {
  return ALL_FIELDS.map(f => BOOL_FIELDS.has(f) ? (body[f] ? 1 : 0) : (body[f] ?? null));
}

// GET /api/listings
router.get('/', (req, res) => {
  try {
    const { status, type, district, q } = req.query;
    let sql = `SELECT * FROM listings WHERE 1=1`;
    const p = [];
    if (status)   { sql += ` AND status=?`;                                       p.push(status); }
    if (type)     { sql += ` AND type=?`;                                         p.push(type); }
    if (district) { sql += ` AND district LIKE ?`;                                p.push(`%${district}%`); }
    if (q)        { sql += ` AND (title LIKE ? OR district LIKE ? OR address LIKE ?)`; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    sql += ` ORDER BY created_at DESC`;
    res.json(db.prepare(sql).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/listings/:id
router.get('/:id', (req, res) => {
  const row = db.prepare(`SELECT * FROM listings WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Portföy bulunamadı' });
  res.json(row);
});

// POST /api/listings
router.post('/', (req, res) => {
  try {
    const cols = ALL_FIELDS.join(', ');
    const phs  = ALL_FIELDS.map(() => '?').join(', ');
    const r = db.prepare(`INSERT INTO listings (${cols}) VALUES (${phs})`).run(...pick(req.body));
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/listings/:id
router.put('/:id', (req, res) => {
  try {
    const set = ALL_FIELDS.map(f => `${f}=?`).join(', ');
    db.prepare(`UPDATE listings SET ${set}, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(...pick(req.body), req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/listings/:id (soft-delete)
router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE listings SET status='arsivlendi' WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
