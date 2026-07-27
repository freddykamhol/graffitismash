import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { hashPassword } from './security.js'

const path = resolve(process.env.DATA_DIR || './data', 'graffitismash.sqlite')
mkdirSync(dirname(path), { recursive: true })
export const db = new Database(path)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','staff')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_hash TEXT,
  user_agent TEXT
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','cancelled')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  pickup_at TEXT,
  notes TEXT,
  items_json TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'pickup',
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','refunded')),
  consent_at TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  accepted_minutes INTEGER,
  decision_at TEXT,
  decided_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS integrations (
  type TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS action_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS page_visits (
  visit_date TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_date, visitor_hash)
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_visits_date ON page_visits(visit_date);
`)

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const adminPassword = process.env.ADMIN_PASSWORD
if (adminEmail && adminPassword && !db.prepare('SELECT id FROM users LIMIT 1').get()) {
  if (adminPassword.length < 14) throw new Error('ADMIN_PASSWORD muss mindestens 14 Zeichen lang sein')
  db.prepare('INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,?)')
    .run(adminEmail, process.env.ADMIN_NAME || 'Administrator', hashPassword(adminPassword), 'admin')
  console.log(`Erster Admin angelegt: ${adminEmail}`)
}

// Datenminimierung: abgelaufene Sitzungen sofort, abgeschlossene Bestellungen standardmäßig nach 90 Tagen löschen.
db.prepare("DELETE FROM sessions WHERE expires_at<=datetime('now')").run()
db.prepare(`DELETE FROM orders WHERE status IN ('accepted','rejected','cancelled')
  AND created_at < datetime('now', ?)`).run(`-${Math.max(1, Number(process.env.ORDER_RETENTION_DAYS) || 90)} days`)
db.prepare("DELETE FROM page_visits WHERE visit_date < date('now','-395 days')").run()

export function auditSafeOrder(row) {
  return row && { ...row, items: JSON.parse(row.items_json), items_json: undefined }
}
