const express = require('express');
const router  = express.Router();
const db      = require('../db');

const NEED_FIELDS = [
  'intent','room_counts','property_types',
  'min_price','max_price','min_sqm','max_sqm',
  'districts','urgency','stage','financing','raw_note'
];

function upsertNeeds(customerId, body) {
  const vals = NEED_FIELDS.map(f => body[f] ?? null);
  const existing = db.prepare(`SELECT id FROM customer_needs WHERE customer_id=?`).get(customerId);
  if (existing) {
    const set = NEED_FIELDS.map(f => `${f}=?`).join(',');
    db.prepare(`UPDATE customer_needs SET ${set} WHERE customer_id=?`).run(...vals, customerId);
  } else {
    const cols = ['customer_id', ...NEED_FIELDS].join(',');
    const phs  = ['?', ...NEED_FIELDS.map(() => '?')].join(',');
    db.prepare(`INSERT INTO customer_needs (${cols}) VALUES (${phs})`).run(customerId, ...vals);
  }
}

// GET /api/customers
router.get('/', (req, res) => {
  try {
    const { status, q } = req.query;
    let sql = `
      SELECT c.*, n.intent, n.max_price, n.min_price, n.districts,
             n.room_counts, n.urgency, n.stage, n.financing
      FROM customers c LEFT JOIN customer_needs n ON n.customer_id=c.id
      WHERE 1=1`;
    const p = [];
    if (status && status !== 'tumu') { sql += ` AND c.status=?`;                     p.push(status); }
    if (q)                           { sql += ` AND (LOWER(c.name) LIKE LOWER(?) OR c.phone LIKE ? OR LOWER(COALESCE(c.email,'')) LIKE LOWER(?))`; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    sql += ` ORDER BY c.last_contact_at DESC, c.created_at DESC`;
    res.json(db.prepare(sql).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/customers/:id
router.get('/:id', (req, res) => {
  const customer = db.prepare(`SELECT * FROM customers WHERE id=?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı' });

  const needs = db.prepare(`SELECT * FROM customer_needs WHERE customer_id=? ORDER BY created_at DESC LIMIT 1`).get(req.params.id);
  const interactions = db.prepare(`
    SELECT i.*, l.title AS listing_title
    FROM interactions i LEFT JOIN listings l ON l.id=i.listing_id
    WHERE i.customer_id=? ORDER BY i.created_at DESC LIMIT 30
  `).all(req.params.id);
  const tasks = db.prepare(`SELECT * FROM tasks WHERE customer_id=? ORDER BY created_at DESC`).all(req.params.id);
  const showings = db.prepare(`
    SELECT s.*, l.title AS listing_title
    FROM showings s LEFT JOIN listings l ON l.id = s.listing_id
    WHERE s.customer_id=? ORDER BY s.date DESC, s.created_at DESC
  `).all(req.params.id);

  res.json({ ...customer, needs, interactions, tasks, showings });
});

// POST /api/customers
router.post('/', (req, res) => {
  try {
    const { name, phone, phone2, email, source, status, heat_score, internal_notes } = req.body;
    const r = db.prepare(`
      INSERT INTO customers (name,phone,phone2,email,source,status,heat_score,internal_notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(name, phone, phone2||null, email||null, source||'diger', status||'yeni', heat_score||0, internal_notes||null);

    upsertNeeds(r.lastInsertRowid, req.body);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/customers/:id
router.put('/:id', (req, res) => {
  try {
    const { name, phone, phone2, email, source, status, heat_score, internal_notes } = req.body;
    db.prepare(`
      UPDATE customers SET name=?,phone=?,phone2=?,email=?,source=?,status=?,
        heat_score=?,internal_notes=?,updated_at=datetime('now','localtime'),
        last_contact_at=datetime('now','localtime')
      WHERE id=?
    `).run(name, phone, phone2||null, email||null, source, status, heat_score||0, internal_notes||null, req.params.id);

    upsertNeeds(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/customers/:id/interactions
router.post('/:id/interactions', (req, res) => {
  try {
    const { type, content, listing_id } = req.body;
    const r = db.prepare(`INSERT INTO interactions (customer_id,listing_id,type,content) VALUES (?,?,?,?)`)
      .run(req.params.id, listing_id||null, type||'not', content);
    db.prepare(`UPDATE customers SET last_contact_at=datetime('now','localtime') WHERE id=?`).run(req.params.id);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
