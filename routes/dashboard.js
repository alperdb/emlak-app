const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', (_req, res) => {
  try {
    const stats = {
      activeListings: db.prepare(`SELECT COUNT(*) c FROM listings WHERE status='aktif'`).get().c,
      activeCustomers: db.prepare(`SELECT COUNT(*) c FROM customers WHERE status NOT IN ('kapandi-basarili','kapandi-vazgecti')`).get().c,
      hotLeads:       db.prepare(`SELECT COUNT(*) c FROM customers WHERE status='sicak'`).get().c,
      pendingTasks:   db.prepare(`SELECT COUNT(*) c FROM tasks WHERE status='bekliyor'`).get().c,
    };

    const recentInteractions = db.prepare(`
      SELECT i.id, i.type, i.content, i.created_at, c.name AS customer_name
      FROM   interactions i
      JOIN   customers c ON c.id = i.customer_id
      ORDER  BY i.created_at DESC
      LIMIT  6
    `).all();

    const pendingTasks = db.prepare(`
      SELECT t.*, c.name AS customer_name
      FROM   tasks t
      LEFT JOIN customers c ON c.id = t.customer_id
      WHERE  t.status = 'bekliyor'
      ORDER  BY t.priority DESC, t.due_date ASC
      LIMIT  8
    `).all();

    res.json({ stats, recentInteractions, pendingTasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
