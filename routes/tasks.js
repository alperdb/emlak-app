const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/tasks
router.get('/', (req, res) => {
  try {
    const { status, scope } = req.query;
    let sql = `
      SELECT t.*, c.name AS customer_name, l.title AS listing_title
      FROM tasks t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN listings  l ON l.id = t.listing_id
      WHERE 1=1
    `;
    const params = [];

    if (status) { sql += ` AND t.status = ?`; params.push(status); }
    if (scope === 'today') {
      sql += ` AND (t.due_date = date('now','localtime') OR t.due_date IS NULL)`;
    }

    sql += ` ORDER BY t.priority DESC, t.due_date ASC, t.created_at DESC`;
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', (req, res) => {
  try {
    const { title, customer_id, listing_id, due_date, priority } = req.body;
    const r = db.prepare(`
      INSERT INTO tasks (title, customer_id, listing_id, due_date, priority)
      VALUES (?,?,?,?,?)
    `).run(title, customer_id || null, listing_id || null, due_date || null, priority || 'normal');

    res.status(201).json({ id: r.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', (req, res) => {
  try {
    const { status, title, due_date, priority } = req.body;
    const fields = [];
    const vals   = [];

    if (status !== undefined)   { fields.push('status=?');   vals.push(status); }
    if (title !== undefined)    { fields.push('title=?');    vals.push(title); }
    if (due_date !== undefined) { fields.push('due_date=?'); vals.push(due_date); }
    if (priority !== undefined) { fields.push('priority=?'); vals.push(priority); }

    if (!fields.length) return res.status(400).json({ error: 'Güncellenecek alan yok' });

    vals.push(req.params.id);
    db.prepare(`UPDATE tasks SET ${fields.join(',')} WHERE id=?`).run(...vals);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM tasks WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
