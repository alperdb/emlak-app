const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'emlak.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Temel tablolar (ilk kurulum) ───────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    type           TEXT NOT NULL DEFAULT 'satilik',
    property_type  TEXT NOT NULL DEFAULT 'konut',
    room_count     TEXT,
    gross_sqm      REAL,
    net_sqm        REAL,
    floor_number   INTEGER,
    total_floors   INTEGER,
    building_age   INTEGER,
    heating_type   TEXT DEFAULT 'kombi',
    is_furnished   INTEGER DEFAULT 0,
    is_in_site     INTEGER DEFAULT 0,
    province       TEXT DEFAULT 'İstanbul',
    district       TEXT,
    neighborhood   TEXT,
    address        TEXT,
    price          REAL NOT NULL,
    monthly_dues   REAL,
    description    TEXT,
    internal_notes TEXT,
    status         TEXT NOT NULL DEFAULT 'aktif',
    created_at     TEXT DEFAULT (datetime('now','localtime')),
    updated_at     TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    phone          TEXT NOT NULL,
    phone2         TEXT,
    email          TEXT,
    source         TEXT DEFAULT 'diger',
    status         TEXT NOT NULL DEFAULT 'yeni',
    heat_score     INTEGER DEFAULT 0,
    internal_notes TEXT,
    created_at     TEXT DEFAULT (datetime('now','localtime')),
    updated_at     TEXT DEFAULT (datetime('now','localtime')),
    last_contact_at TEXT
  );

  CREATE TABLE IF NOT EXISTS customer_needs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    intent      TEXT DEFAULT 'alma',
    room_counts TEXT,
    min_price   REAL,
    max_price   REAL,
    districts   TEXT,
    raw_note    TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    listing_id  INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    type        TEXT NOT NULL DEFAULT 'not',
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    listing_id  INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    due_date    TEXT,
    priority    TEXT DEFAULT 'normal',
    status      TEXT DEFAULT 'bekliyor',
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pipeline (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    listing_id  INTEGER REFERENCES listings(id)  ON DELETE SET NULL,
    title       TEXT NOT NULL,
    stage       TEXT NOT NULL DEFAULT 'lead',
    notes       TEXT,
    value       REAL,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  );

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

  INSERT OR IGNORE INTO settings (key, value) VALUES
    ('office_name',  'Emlak Ofisim'),
    ('advisor_name', 'Danışman'),
    ('ai_enabled',   'false'),
    ('ai_api_key',   '');
`);

// ─── Migration: listings — yeni alanlar ─────────────
// ALTER TABLE IF COLUMN NOT EXISTS benzeri için pragma kullanıyoruz
const listingCols = db.pragma('table_info(listings)').map(c => c.name);

const listingMigrations = [
  ['facing',       `ALTER TABLE listings ADD COLUMN facing TEXT`],
  ['deed_status',  `ALTER TABLE listings ADD COLUMN deed_status TEXT`],
  ['occupancy_status', `ALTER TABLE listings ADD COLUMN occupancy_status TEXT DEFAULT 'bos'`],
  ['deposit',      `ALTER TABLE listings ADD COLUMN deposit REAL`],
];
for (const [col, sql] of listingMigrations) {
  if (!listingCols.includes(col)) db.exec(sql);
}

// ─── Migration: customer_needs — yeni alanlar ───────
const needsCols = db.pragma('table_info(customer_needs)').map(c => c.name);

const needsMigrations = [
  ['min_sqm',        `ALTER TABLE customer_needs ADD COLUMN min_sqm REAL`],
  ['max_sqm',        `ALTER TABLE customer_needs ADD COLUMN max_sqm REAL`],
  ['urgency',        `ALTER TABLE customer_needs ADD COLUMN urgency TEXT DEFAULT 'belirsiz'`],
  ['stage',          `ALTER TABLE customer_needs ADD COLUMN stage TEXT DEFAULT 'arastirma'`],
  ['financing',      `ALTER TABLE customer_needs ADD COLUMN financing TEXT DEFAULT 'belirsiz'`],
  ['property_types', `ALTER TABLE customer_needs ADD COLUMN property_types TEXT`],
];
for (const [col, sql] of needsMigrations) {
  if (!needsCols.includes(col)) db.exec(sql);
}

module.exports = db;
