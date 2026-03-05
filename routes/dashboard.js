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

    // "Bugün kimi aramalıyım"
    const callList = [];
    const seen = new Set();

    // 1. Sicak — 3 gün aranmadı
    db.prepare(`
      SELECT id, name, phone, status, last_contact_at
      FROM customers
      WHERE status='sicak'
      AND (last_contact_at IS NULL OR last_contact_at < datetime('now','-3 days','localtime'))
      LIMIT 5
    `).all().forEach(c => {
      if (!seen.has(c.id)) { seen.add(c.id); callList.push({ ...c, call_reason: '🔴 Sıcak aday — 3 gün aranmadı' }); }
    });

    // 2. Ilik — 3 gün aranmadı
    db.prepare(`
      SELECT id, name, phone, status, last_contact_at
      FROM customers
      WHERE status='ilik'
      AND (last_contact_at IS NULL OR last_contact_at < datetime('now','-3 days','localtime'))
      LIMIT 5
    `).all().forEach(c => {
      if (!seen.has(c.id)) { seen.add(c.id); callList.push({ ...c, call_reason: '🟡 Ilık aday — 3 gün aranmadı' }); }
    });

    // 3. Yeni — 7 gün aranmadı
    db.prepare(`
      SELECT id, name, phone, status, last_contact_at
      FROM customers
      WHERE status='yeni'
      AND (last_contact_at IS NULL OR last_contact_at < datetime('now','-7 days','localtime'))
      LIMIT 3
    `).all().forEach(c => {
      if (!seen.has(c.id)) { seen.add(c.id); callList.push({ ...c, call_reason: '🆕 Yeni müşteri — 7 gün aranmadı' }); }
    });

    // 4. Gösterim yapıldı, teklif yok
    db.prepare(`
      SELECT DISTINCT c.id, c.name, c.phone, c.status, c.last_contact_at
      FROM customers c
      JOIN showings s ON s.customer_id = c.id
      WHERE s.result NOT IN ('teklif_verdi','iptal')
      AND NOT EXISTS (
        SELECT 1 FROM pipeline p
        WHERE p.customer_id = c.id
        AND p.stage IN ('teklif','pazarlik','kapandi')
      )
      AND c.status NOT IN ('kapandi-basarili','kapandi-vazgecti')
      LIMIT 4
    `).all().forEach(c => {
      if (!seen.has(c.id)) { seen.add(c.id); callList.push({ ...c, call_reason: '🏠 Gösterim yapıldı — teklif yok' }); }
    });

    res.json({ stats, recentInteractions, pendingTasks, callList: callList.slice(0, 8) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
