# CRM Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Pipeline default page, customer timeline, showings table, dashboard call-list, and listing match panel — all additive, no rewrites.

**Architecture:** SQLite migrations via `db.js` pragma pattern already in use. New `showings` route mirrors existing route structure. All frontend changes are additive to `public/app.js`.

**Tech Stack:** Node.js, Express, better-sqlite3, Tailwind CSS (CDN), vanilla JS SPA with hash routing.

---

## Task 1: Add showings table to db.js

**Files:**
- Modify: `db.js`

**Step 1: Add CREATE TABLE after the pipeline block (~line 100)**

Add this block inside the `db.exec(...)` call (before the closing backtick):

```sql
  CREATE TABLE IF NOT EXISTS showings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    listing_id     INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    result         TEXT NOT NULL DEFAULT 'kararsiz',
    price_feedback TEXT DEFAULT 'uygun',
    reason         TEXT,
    date           TEXT DEFAULT (date('now','localtime')),
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  );
```

**Step 2: Verify**

Start server: `node server.js`
Check console — no error. App loads at `http://localhost:3000`.

**Step 3: Commit**

```bash
git add db.js
git commit -m "feat: add showings table to schema"
```

---

## Task 2: Create routes/showings.js

**Files:**
- Create: `routes/showings.js`

**Step 1: Write the file**

```js
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
    // Update customer last_contact_at
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
  db.prepare(`DELETE FROM showings WHERE id=?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
```

**Step 2: Register in server.js**

Add after the pipeline route line:

```js
app.use('/api/showings',   require('./routes/showings'));
```

**Step 3: Manual test**

```bash
curl -X POST http://localhost:3000/api/showings \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1,"result":"begendi","price_feedback":"uygun","reason":"Test","date":"2026-02-25"}'
```
Expected: `{"id":1}`

```bash
curl http://localhost:3000/api/showings?customer_id=1
```
Expected: array with 1 item.

**Step 4: Commit**

```bash
git add routes/showings.js server.js
git commit -m "feat: showings CRUD route"
```

---

## Task 3: Update customers/:id to include showings

**Files:**
- Modify: `routes/customers.js` (GET /:id handler, ~line 42–55)

**Step 1: Add showings query inside the GET /:id handler**

Find this block:
```js
  const tasks = db.prepare(`SELECT * FROM tasks WHERE customer_id=? ORDER BY created_at DESC`).all(req.params.id);

  res.json({ ...customer, needs, interactions, tasks });
```

Replace with:
```js
  const tasks = db.prepare(`SELECT * FROM tasks WHERE customer_id=? ORDER BY created_at DESC`).all(req.params.id);
  const showings = db.prepare(`
    SELECT s.*, l.title AS listing_title
    FROM showings s LEFT JOIN listings l ON l.id = s.listing_id
    WHERE s.customer_id=? ORDER BY s.date DESC, s.created_at DESC
  `).all(req.params.id);

  res.json({ ...customer, needs, interactions, tasks, showings });
```

**Step 2: Verify**

```bash
curl http://localhost:3000/api/customers/1
```
Expected: JSON now has a `showings` array (empty `[]` is fine).

**Step 3: Commit**

```bash
git add routes/customers.js
git commit -m "feat: include showings in customer detail endpoint"
```

---

## Task 4: Add listings/:id/matches endpoint

**Files:**
- Modify: `routes/listings.js`

**Step 1: Add after the GET /:id route (after line 38)**

```js
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
```

**Step 2: Verify**

```bash
curl http://localhost:3000/api/listings/1/matches
```
Expected: `{ listing: {...}, matches: [...] }`

**Step 3: Commit**

```bash
git add routes/listings.js
git commit -m "feat: listing matches endpoint with scoring"
```

---

## Task 5: Update dashboard endpoint — "who to call today"

**Files:**
- Modify: `routes/dashboard.js`

**Step 1: Add callList query inside the GET / handler, before `res.json`**

Find the `res.json({ stats, recentInteractions, pendingTasks });` line and replace with:

```js
    // "Bugün kimi aramalıyım"
    const callList = [];
    const seen = new Set();

    // 1. Sicak — 3 gün aranmadı
    db.prepare(`
      SELECT id, name, phone, status, last_contact_at
      FROM customers
      WHERE status='sicak'
      AND (last_contact_at IS NULL OR last_contact_at < datetime('now','-3 days','localtime'))
      AND status NOT IN ('kapandi-basarili','kapandi-vazgecti')
      LIMIT 5
    `).all().forEach(c => {
      if (!seen.has(c.id)) { seen.add(c.id); callList.push({ ...c, call_reason: '🔴 Sıcak lead — 3 gün aranmadı' }); }
    });

    // 2. Ilik — 3 gün aranmadı
    db.prepare(`
      SELECT id, name, phone, status, last_contact_at
      FROM customers
      WHERE status='ilik'
      AND (last_contact_at IS NULL OR last_contact_at < datetime('now','-3 days','localtime'))
      AND status NOT IN ('kapandi-basarili','kapandi-vazgecti')
      LIMIT 5
    `).all().forEach(c => {
      if (!seen.has(c.id)) { seen.add(c.id); callList.push({ ...c, call_reason: '🟡 Ilık lead — 3 gün aranmadı' }); }
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
```

**Step 2: Verify**

```bash
curl http://localhost:3000/api/dashboard
```
Expected: JSON has `callList` array.

**Step 3: Commit**

```bash
git add routes/dashboard.js
git commit -m "feat: dashboard call list — who to call today"
```

---

## Task 6: Frontend — Pipeline as default page

**Files:**
- Modify: `public/app.js` (~line 93)
- Modify: `public/index.html` (nav order)

**Step 1: Change default navigation in app.js**

Find in the `navigate()` function (~line 84):
```js
  (routes[hash] || renderDashboard)();
```

Replace with:
```js
  (routes[hash] || renderPipeline)();
```

**Step 2: Change window.load to default to pipeline (~line 93)**

Find:
```js
window.addEventListener('load', () => {
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });
  loadOfficeName();
  updateTaskBadge();
  navigate();
});
```

Replace with:
```js
window.addEventListener('load', () => {
  document.getElementById('current-date').textContent =
    new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long' });
  loadOfficeName();
  updateTaskBadge();
  if (!location.hash || location.hash === '#/') {
    location.hash = '#/pipeline';
  } else {
    navigate();
  }
});
```

**Step 3: Reorder nav in index.html — Pipeline first**

Find the nav links block. Move the Pipeline `<a>` tag to be first, before Dashboard.

```html
<!-- Nav Links — Pipeline ilk sırada -->
<a href="#/pipeline" class="nav-link ...">
  <svg ...pipeline icon...</svg>
  <span>Pipeline</span>
</a>

<a href="#/" class="nav-link ...">
  <svg ...dashboard icon...</svg>
  <span>Dashboard</span>
</a>
```

**Step 4: Verify**

Open `http://localhost:3000` — URL should change to `#/pipeline` and Pipeline kanban should load.

**Step 5: Commit**

```bash
git add public/app.js public/index.html
git commit -m "feat: pipeline as default landing page"
```

---

## Task 7: Frontend — Customer Timeline

**Files:**
- Modify: `public/app.js` — `openCustomerDetail` function (~line 601)

**Step 1: Add timeline CSS styles to index.html `<style>` block**

Add inside `<style>`:
```css
/* Timeline */
.timeline { position:relative; padding-left:28px; }
.timeline::before { content:''; position:absolute; left:9px; top:0; bottom:0; width:2px; background:#e5e7eb; }
.timeline-item { position:relative; margin-bottom:16px; }
.timeline-dot { position:absolute; left:-23px; top:3px; width:16px; height:16px; border-radius:50%; border:2px solid #fff; display:flex; align-items:center; justify-content:center; font-size:9px; }
.tl-arama     { background:#3b82f6; }
.tl-not       { background:#6b7280; }
.tl-gorusum   { background:#8b5cf6; }
.tl-gosterim  { background:#f59e0b; }
.tl-teklif    { background:#10b981; }
.tl-email     { background:#06b6d4; }
.tl-mesaj     { background:#64748b; }
.result-begendi      { background:#d1fae5; color:#065f46; }
.result-kararsiz     { background:#fef3c7; color:#92400e; }
.result-begenmedi    { background:#fee2e2; color:#991b1b; }
.result-teklif_verdi { background:#dbeafe; color:#1e40af; }
.result-iptal        { background:#f3f4f6; color:#6b7280; }
.pf-yuksek { background:#fee2e2; color:#991b1b; }
.pf-uygun  { background:#d1fae5; color:#065f46; }
.pf-dusuk  { background:#dbeafe; color:#1e40af; }
```

**Step 2: Replace the interactions panel in `openCustomerDetail`**

Find this block (~line 643):
```js
      <!-- Etkileşimler -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 class="font-semibold text-gray-900 text-sm">Etkileşimler</h2>
          <button onclick="openInteractionModal(${c.id})" class="btn-ghost">+ Not Ekle</button>
        </div>
        <div class="divide-y divide-gray-50 max-h-80 overflow-y-auto">
          ${c.interactions.length === 0
            ? `<p class="text-gray-400 text-sm text-center py-8">Henüz etkileşim yok</p>`
            : c.interactions.map(i => `
                <div class="px-5 py-3">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">${i.type}</span>
                    <span class="ml-auto text-xs text-gray-400">${relDate(i.created_at)}</span>
                  </div>
                  <p class="text-sm text-gray-700">${i.content}</p>
                </div>`).join('')
          }
        </div>
      </div>
```

Replace with:
```js
      <!-- Timeline (Etkileşimler + Gösterimler) -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 class="font-semibold text-gray-900 text-sm">Aktivite Zaman Çizelgesi</h2>
          <div class="flex gap-2">
            <button onclick="openShowingModal(${c.id})" class="btn-ghost">📍 Gösterim</button>
            <button onclick="openInteractionModal(${c.id})" class="btn-ghost">+ Not</button>
          </div>
        </div>
        <div class="p-5 max-h-96 overflow-y-auto">
          ${buildTimeline(c.interactions, c.showings || [])}
        </div>
      </div>
```

**Step 3: Add `buildTimeline` helper function** (add before `openCustomerDetail`):

```js
const TL_DOT = {
  arama:'tl-arama', not:'tl-not', gorusum:'tl-gorusum',
  gosterim:'tl-gosterim', teklif:'tl-teklif',
  email:'tl-email', mesaj:'tl-mesaj', gosteriminotu:'tl-gosterim'
};
const TL_ICON = {
  arama:'📞', not:'📝', gorusum:'🤝', email:'📧', mesaj:'💬',
  gosterim:'🏠', gosteriminotu:'🏠', teklif:'💰'
};

function buildTimeline(interactions, showings) {
  const items = [
    ...interactions.map(i => ({ ...i, _kind: 'interaction', _date: i.created_at })),
    ...showings.map(s => ({ ...s, _kind: 'showing', _date: s.date || s.created_at })),
  ].sort((a, b) => new Date(b._date) - new Date(a._date));

  if (items.length === 0) {
    return `<p class="text-gray-400 text-sm text-center py-6">Henüz aktivite yok</p>`;
  }

  return `<div class="timeline">${items.map(item => {
    if (item._kind === 'interaction') {
      const dotClass = TL_DOT[item.type] || 'tl-not';
      const icon = TL_ICON[item.type] || '📝';
      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotClass}">${icon}</div>
          <div class="ml-1">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">${item.type}</span>
              <span class="text-xs text-gray-400 ml-auto">${relDate(item.created_at)}</span>
            </div>
            <p class="text-sm text-gray-700">${item.content}</p>
            ${item.listing_title ? `<p class="text-xs text-gray-400 mt-0.5">🏢 ${item.listing_title}</p>` : ''}
          </div>
        </div>`;
    } else {
      // showing
      return `
        <div class="timeline-item">
          <div class="timeline-dot tl-gosterim">🏠</div>
          <div class="ml-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-semibold text-amber-700">Gösterim</span>
              <span class="badge result-${item.result} text-xs">${item.result}</span>
              ${item.price_feedback ? `<span class="badge pf-${item.price_feedback} text-xs">Fiyat: ${item.price_feedback}</span>` : ''}
              <span class="text-xs text-gray-400 ml-auto">${fmtDate(item._date)}</span>
            </div>
            ${item.listing_title ? `<p class="text-sm text-gray-700">🏢 ${item.listing_title}</p>` : ''}
            ${item.reason ? `<p class="text-xs text-gray-500 italic mt-0.5">${item.reason}</p>` : ''}
          </div>
        </div>`;
    }
  }).join('')}</div>`;
}
```

**Step 4: Verify**

Open a customer profile. Timeline should show interactions and showings in date order.

**Step 5: Commit**

```bash
git add public/app.js public/index.html
git commit -m "feat: customer timeline with interactions and showings"
```

---

## Task 8: Frontend — Gösterim Ekle Modal

**Files:**
- Modify: `public/app.js` — add `openShowingModal` function after `openInteractionModal`

**Step 1: Add function after `openInteractionModal` (~line 983)**

```js
// ─── GÖSTERİM MODAL ─────────────────────────────────
async function openShowingModal(customerId) {
  let listings = [];
  try { listings = await apiFetch('/listings?status=aktif'); } catch (_) {}

  openModal(`
    <div class="p-6">
      <h2 class="text-lg font-bold text-gray-900 mb-5">📍 Gösterim Kaydı Ekle</h2>
      <form id="showing-form" class="space-y-4">
        <div>
          <label class="text-sm font-medium text-gray-700">Portföy</label>
          <select name="listing_id" class="inp mt-1">
            <option value="">— Seçiniz —</option>
            ${listings.map(l => `<option value="${l.id}">${l.title} · ${l.district || ''} · ${fmt(l.price)}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm font-medium text-gray-700">Sonuç</label>
            <select name="result" class="inp mt-1">
              <option value="begendi">Beğendi</option>
              <option value="kararsiz" selected>Kararsız</option>
              <option value="begenmedi">Beğenmedi</option>
              <option value="teklif_verdi">Teklif Verdi</option>
              <option value="iptal">İptal</option>
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700">Fiyat Görüşü</label>
            <select name="price_feedback" class="inp mt-1">
              <option value="uygun" selected>Uygun</option>
              <option value="yuksek">Yüksek</option>
              <option value="dusuk">Düşük</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Gösterim Tarihi</label>
          <input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" class="inp mt-1" />
        </div>
        <div>
          <label class="text-sm font-medium text-gray-700">Neden / Açıklama</label>
          <textarea name="reason" rows="3" class="inp mt-1" placeholder="Müşterinin yorumu, neden beğendi/beğenmedi..."></textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button type="button" onclick="closeModal()" class="btn-secondary">İptal</button>
          <button type="submit" class="btn-primary">Kaydet</button>
        </div>
      </form>
    </div>
  `);
  document.getElementById('showing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.customer_id = customerId;
    try {
      await apiFetch('/showings', { method: 'POST', body: data });
      closeModal();
      toast('Gösterim kaydedildi');
      openCustomerDetail(customerId);
    } catch (err) { toast(err.message, 'err'); }
  });
}
```

**Step 2: Verify**

Open customer detail → click "📍 Gösterim" button → form modal opens. Save → timeline updates with new showing card.

**Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: showing record modal (customer detail)"
```

---

## Task 9: Frontend — Dashboard "Bugün Kimi Aramalıyım"

**Files:**
- Modify: `public/app.js` — `renderDashboard` function (~line 162)

**Step 1: Destructure `callList` from the dashboard API response**

Find:
```js
    const { stats, recentInteractions, pendingTasks } = await apiFetch('/dashboard');
```

Replace with:
```js
    const { stats, recentInteractions, pendingTasks, callList } = await apiFetch('/dashboard');
```

**Step 2: Add call list panel to the dashboard HTML**

Find the `<!-- Alt İki Panel -->` div. Change the grid to 3 columns and add the call list as a third panel, OR add it above the existing two-panel grid. Recommended: add it full-width above the grid.

Find this line inside `setContent(...)`:
```js
      <!-- Alt İki Panel -->
      <div class="grid lg:grid-cols-2 gap-5">
```

Replace with:
```js
      <!-- Bugün Kimi Aramalıyım -->
      ${callList && callList.length > 0 ? `
      <div class="bg-white rounded-xl border border-orange-200 overflow-hidden shadow-sm mb-5">
        <div class="flex items-center justify-between px-5 py-4 border-b border-orange-100 bg-orange-50">
          <h2 class="font-semibold text-orange-900 text-sm">📞 Bugün Kimi Aramalıyım?</h2>
          <span class="text-xs text-orange-600 font-medium">${callList.length} kişi</span>
        </div>
        <div class="divide-y divide-gray-50">
          ${callList.map(c => `
            <div class="flex items-center gap-4 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-gray-900 text-sm">${c.name}</span>
                  ${statusBadge(c.status)}
                </div>
                <p class="text-xs text-gray-500 mt-0.5">${c.call_reason}</p>
              </div>
              <a href="tel:${c.phone}" class="font-mono text-sm text-blue-600 hover:text-blue-800 shrink-0">${c.phone}</a>
              <button onclick="openCustomerDetail(${c.id})" class="btn-ghost shrink-0">Profil</button>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Alt İki Panel -->
      <div class="grid lg:grid-cols-2 gap-5">
```

**Step 3: Close the grid div properly**

The existing HTML already closes the grid div with `</div>`. No change needed there.

**Step 4: Verify**

Open Dashboard. If any customers match the call criteria, an orange panel appears above the two panels. Each row shows name, status badge, reason, phone link, and profile button.

**Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: dashboard call list panel"
```

---

## Task 10: Frontend — Portföy Detay + "Kime Uygun"

**Files:**
- Modify: `public/app.js` — add `openListingDetail` function, update `tableRowListing`

**Step 1: Add "Detay" button to `tableRowListing`**

Find in `tableRowListing`:
```js
        <div class="flex gap-1">
          <button onclick="openListingModal(${l.id})" class="btn-ghost">Düzenle</button>
        </div>
```

Replace with:
```js
        <div class="flex gap-1">
          <button onclick="openListingDetail(${l.id})" class="btn-ghost">Detay</button>
          <button onclick="openListingModal(${l.id})" class="btn-ghost">Düzenle</button>
        </div>
```

**Step 2: Add `openListingDetail` function** (add after `openListingModal`):

```js
// ─── PORTFÖY DETAY ────────────────────────────────────
async function openListingDetail(id) {
  setContent(`<div class="text-center text-gray-400 mt-20 text-sm">Yükleniyor...</div>`);
  try {
    const { listing: l, matches } = await apiFetch(`/listings/${id}/matches`);

    const SCORE_COLOR = s => s >= 70 ? 'text-green-600' : s >= 40 ? 'text-amber-600' : 'text-gray-500';
    const SCORE_BG    = s => s >= 70 ? 'bg-green-50 border-green-200' : s >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200';

    setContent(`
      <div class="mb-5">
        <button onclick="renderListings()" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Portföy listesine dön
        </button>
      </div>

      <!-- Listing Info Card -->
      <div class="bg-white rounded-xl border border-gray-200 p-6 mb-5 shadow-sm">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex gap-2 mb-2">${statusBadge(l.status)}</div>
            <h1 class="text-2xl font-bold text-gray-900">${l.title}</h1>
            <p class="text-gray-500 mt-1 text-sm">${[l.neighborhood, l.district, l.province].filter(Boolean).join(', ')}</p>
            <div class="flex gap-4 mt-2 text-sm text-gray-600">
              ${l.room_count ? `<span>🛏 ${l.room_count}</span>` : ''}
              ${l.net_sqm ? `<span>📐 ${l.net_sqm} m²</span>` : ''}
              ${l.floor_number ? `<span>🏢 Kat ${l.floor_number}</span>` : ''}
            </div>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold text-blue-700">${fmt(l.price)}</p>
            ${l.monthly_dues ? `<p class="text-sm text-gray-400">Aidat: ${fmt(l.monthly_dues)}/ay</p>` : ''}
            <button onclick="openListingModal(${l.id})" class="btn-secondary text-sm mt-3">Düzenle</button>
          </div>
        </div>
        ${l.description ? `<p class="text-sm text-gray-600 mt-4 pt-4 border-t border-gray-100">${l.description}</p>` : ''}
        ${l.internal_notes ? `<p class="text-xs text-gray-400 italic mt-2">İç not: ${l.internal_notes}</p>` : ''}
      </div>

      <!-- Kime Uygun -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 class="font-semibold text-gray-900 text-sm">🎯 Kime Uygun?</h2>
          <span class="text-xs text-gray-500">${matches.length} eşleşme bulundu</span>
        </div>
        ${matches.length === 0
          ? `<p class="text-gray-400 text-sm text-center py-10">Kriterlere uyan müşteri bulunamadı</p>`
          : `<div class="divide-y divide-gray-50">
              ${matches.map(c => `
                <div class="flex items-center gap-4 px-5 py-4 ${SCORE_BG(c.score)}">
                  <div class="shrink-0 text-center w-14">
                    <div class="text-xl font-bold ${SCORE_COLOR(c.score)}">${c.score}%</div>
                    <div class="text-xs text-gray-400">uyum</div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-semibold text-gray-900 text-sm">${c.name}</span>
                      ${statusBadge(c.status)}
                    </div>
                    <div class="flex flex-wrap gap-1">
                      ${c.reasons.map(r => `<span class="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">${r}</span>`).join('')}
                    </div>
                    ${c.max_price ? `<p class="text-xs text-gray-400 mt-1">Bütçe: maks ${fmt(c.max_price)}</p>` : ''}
                  </div>
                  <div class="shrink-0 flex flex-col gap-1 text-right">
                    <a href="tel:${c.phone}" class="font-mono text-xs text-blue-600">${c.phone}</a>
                    <button onclick="openCustomerDetail(${c.id})" class="btn-ghost">Profil</button>
                  </div>
                </div>`).join('')}
            </div>`
        }
      </div>
    `);
  } catch (err) {
    setContent(`<p class="text-red-500 text-center mt-20 text-sm">Hata: ${err.message}</p>`);
  }
}
```

**Step 3: Verify**

Open Portföy → click "Detay" on any listing. Detail page appears with listing info and "Kime Uygun" panel showing matched customers with percentage and reasons.

**Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: listing detail page with match scoring panel"
```

---

## Final Verification Checklist

- [ ] App opens at `http://localhost:3000` → redirects to Pipeline
- [ ] Pipeline kanban loads, nav shows Pipeline first
- [ ] Customer detail shows timeline with icons and showing cards
- [ ] "📍 Gösterim" button opens modal → saves → appears in timeline
- [ ] Dashboard shows orange "📞 Bugün Kimi Aramalıyım" panel (when data exists)
- [ ] Portföy list has "Detay" button → opens detail page
- [ ] "Kime Uygun" panel shows customers with % scores and reason tags
