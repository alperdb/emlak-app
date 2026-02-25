# Emlak Ofisi CRM Upgrade — Design Document
**Date:** 2026-02-25
**Scope:** 5 additive features, no rewrites

---

## Affected Files

| File | Change |
|---|---|
| `db.js` | Add `showings` table via migration |
| `routes/showings.js` | New — CRUD for showings |
| `routes/dashboard.js` | Add "who to call today" query |
| `routes/listings.js` | Add `GET /:id` and `GET /:id/matches` |
| `routes/customers.js` | `GET /:id` also returns showings |
| `server.js` | Register `/api/showings` route |
| `public/app.js` | Additive UI changes for all 5 features |

---

## Feature 1 — Default Page: Pipeline

**Change:** In `window.load` handler, if `location.hash` is empty or `#/`, redirect to `#/pipeline`.
Move Pipeline nav link to first position in sidebar.

---

## Feature 2 — Customer Timeline

**Change:** Replace flat interaction list in `openCustomerDetail` with a vertical timeline.
`GET /api/customers/:id` also returns `showings[]` merged and sorted by date.

Timeline card types:
- **Interaction**: icon by type (📞 arama, 💬 mesaj, 📝 not, 🤝 gorusum, 📧 email), date, content
- **Showing**: 🏠 icon, listing name, result badge, price_feedback badge, reason

---

## Feature 3 — Showings Table

```sql
CREATE TABLE showings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  listing_id      INTEGER REFERENCES listings(id) ON DELETE SET NULL,
  result          TEXT NOT NULL DEFAULT 'kararsiz',
  price_feedback  TEXT DEFAULT 'uygun',
  reason          TEXT,
  date            TEXT DEFAULT (date('now','localtime')),
  created_at      TEXT DEFAULT (datetime('now','localtime'))
);
```

**result values:** `begendi` | `kararsiz` | `begenmedi` | `teklif_verdi` | `iptal`
**price_feedback values:** `yuksek` | `uygun` | `dusuk`

Routes (`routes/showings.js`):
- `GET /` — list, supports `?customer_id=` and `?listing_id=` filters
- `POST /` — create
- `PUT /:id` — update
- `DELETE /:id` — delete

"Gösterim Ekle" button in customer detail modal: customer fixed, listing dropdown, result, price_feedback, reason, date.

---

## Feature 4 — Dashboard "Bugün Kimi Aramalıyım"

**Query logic** (up to 8 customers, priority order):

1. Status `sicak` AND last_contact_at NULL or > 3 days ago
2. Status `ilik` AND last_contact_at NULL or > 3 days ago
3. Status `yeni` AND last_contact_at NULL or > 7 days ago
4. Had a showing with result NOT IN (`teklif_verdi`, `iptal`) AND no pipeline entry at stage `teklif` or later

Returns: name, phone, status, last_contact_at, reason_label (e.g., "3 gün aranmadı", "Gösterim yapıldı teklif yok")

---

## Feature 5 — Listing Detail "Kime Uygun"

New function `openListingDetail(id)` renders a full detail page.
New endpoint `GET /api/listings/:id/matches`.

**Match scoring (0–100%):**

| Criterion | Points |
|---|---|
| `max_price >= listing.price` | 40 pts |
| `districts` contains `listing.district` | 30 pts |
| `room_counts` contains `listing.room_count` | 20 pts |
| `intent` matches listing `type` (alma↔satilik, kiralama↔kiralik) | 10 pts |

Returns customers with score > 0, sorted by score DESC.
Each result includes: name, phone, score%, match_reasons[] (why each point was awarded).
