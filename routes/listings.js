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

const DEFAULTS = { status: 'aktif' };
function pick(body) {
  return ALL_FIELDS.map(f => BOOL_FIELDS.has(f) ? (body[f] ? 1 : 0) : (body[f] ?? DEFAULTS[f] ?? null));
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
    if (q)        { sql += ` AND (LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(district,'')) LIKE LOWER(?) OR LOWER(COALESCE(address,'')) LIKE LOWER(?))`; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    sql += ` ORDER BY created_at DESC`;
    res.json(db.prepare(sql).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/listings/:id/matches
router.get('/:id/matches', (req, res) => {
  try {
    const listing = db.prepare(`SELECT * FROM listings WHERE id=?`).get(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Portföy bulunamadı' });

    const customers = db.prepare(`
      SELECT c.id, c.name, c.phone, c.status, c.last_contact_at,
             n.intent, n.max_price, n.min_price, n.districts,
             n.room_counts, n.urgency, n.financing
      FROM customers c
      LEFT JOIN customer_needs n ON n.customer_id = c.id
      WHERE c.status NOT IN ('kapandi-basarili','kapandi-vazgecti')
    `).all();

    const results = customers.map(c => {
      const reasons = [];
      let score = 0;

      // Intent match (10 pts)
      const intentOk = (c.intent === 'alma' && listing.type === 'satilik') ||
                        (c.intent === 'kiralama' && listing.type === 'kiralik');
      if (c.intent && intentOk) { score += 10; reasons.push('İşlem tipi uyuyor'); }

      // Price match (40 pts)
      if (c.max_price && c.max_price >= listing.price) {
        score += 40; reasons.push('Bütçe yeterli');
      }

      // District match (30 pts)
      if (c.districts && listing.district &&
          c.districts.toLowerCase().includes(listing.district.toLowerCase())) {
        score += 30; reasons.push('Tercih semti uyuyor');
      }

      // Room count match (20 pts)
      if (c.room_counts && listing.room_count &&
          c.room_counts.includes(listing.room_count)) {
        score += 20; reasons.push('Oda sayısı uyuyor');
      }

      return { ...c, score, reasons };
    });

    const matches = results
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);

    res.json({ listing, matches });
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
    if (!req.body.property_type) {
      const existing = db.prepare(`SELECT property_type FROM listings WHERE id=?`).get(req.params.id);
      if (existing) req.body.property_type = existing.property_type || 'konut';
    }
    const set = ALL_FIELDS.map(f => `${f}=?`).join(', ');
    db.prepare(`UPDATE listings SET ${set}, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(...pick(req.body), req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/listings/:id (soft-delete → arşiv)
router.delete('/:id', (req, res) => {
  db.prepare(`UPDATE listings SET status='arsivlendi' WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/listings/:id/permanent (kalıcı sil)
router.delete('/:id/permanent', (req, res) => {
  try {
    db.prepare(`DELETE FROM listings WHERE id=?`).run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
