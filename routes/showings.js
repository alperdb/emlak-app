const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/showings?customer_id=&listing_id=
router.get('/', (req, res) => {
  try {
    const { customer_id, listing_id } = req.query;
    let sql = `
      SELECT s.*, c.name AS customer_name, l.title AS listing_title
      FROM showings s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN listings  l ON l.id = s.listing_id
      WHERE 1=1`;
    const p = [];
    if (customer_id) { sql += ` AND s.customer_id=?`; p.push(customer_id); }
    if (listing_id)  { sql += ` AND s.listing_id=?`;  p.push(listing_id); }
    sql += ` ORDER BY s.date DESC, s.created_at DESC`;
    res.json(db.prepare(sql).all(...p));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/showings
router.post('/', (req, res) => {
  try {
    const { customer_id, listing_id, result, price_feedback, reason, date } = req.body;
    const r = db.prepare(`
      INSERT INTO showings (customer_id, listing_id, result, price_feedback, reason, date)
      VALUES (?,?,?,?,?,?)
    `).run(
      customer_id,
      listing_id || null,
      result || 'kararsiz',
      price_feedback || 'uygun',
      reason || null,
      date || null
    );
    db.prepare(`UPDATE customers SET last_contact_at=datetime('now','localtime') WHERE id=?`)
      .run(customer_id);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/showings/:id
router.put('/:id', (req, res) => {
  try {
    const { result, price_feedback, reason, date } = req.body;
    db.prepare(`
      UPDATE showings SET result=?, price_feedback=?, reason=?, date=? WHERE id=?
    `).run(result, price_feedback, reason || null, date, req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/showings/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM showings WHERE id=?`).run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
