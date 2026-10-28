import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { APPLICATION_STATUSES } from './constants.js';

if (config.dbFile !== ':memory:') fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
const statusList = APPLICATION_STATUSES.map((s) => `'${s}'`).join(',');

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','recruiter','admin')),
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  register_number    TEXT NOT NULL UNIQUE COLLATE NOCASE,
  department         TEXT NOT NULL,
  year               INTEGER NOT NULL CHECK (year BETWEEN 1 AND 5),
  cgpa               REAL CHECK (cgpa BETWEEN 0 AND 10),
  skills             TEXT NOT NULL DEFAULT '[]',
  phone              TEXT,
  resume_file        TEXT,
  resume_name        TEXT,
  resume_uploaded_at TEXT,
  updated_at         TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS recruiter_profiles (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name     TEXT NOT NULL,
  website          TEXT,
  phone            TEXT,
  designation      TEXT,
  about            TEXT,
  approval_status  TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approval_remarks TEXT,
  reviewed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TEXT
);

CREATE TABLE IF NOT EXISTS internships (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  company              TEXT NOT NULL,
  description          TEXT NOT NULL,
  domain               TEXT NOT NULL,
  required_skills      TEXT NOT NULL DEFAULT '[]',
  min_cgpa             REAL NOT NULL DEFAULT 0,
  eligible_departments TEXT NOT NULL DEFAULT '[]',
  eligible_years       TEXT NOT NULL DEFAULT '[]',
  location             TEXT NOT NULL,
  mode                 TEXT NOT NULL CHECK (mode IN ('onsite','remote','hybrid')),
  duration_weeks       INTEGER NOT NULL CHECK (duration_weeks > 0),
  stipend              INTEGER NOT NULL DEFAULT 0 CHECK (stipend >= 0),
  openings             INTEGER NOT NULL DEFAULT 1 CHECK (openings > 0),
  deadline             TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','open','rejected','closed')),
  moderation_remarks   TEXT,
  published_at         TEXT,
  created_at           TEXT NOT NULL DEFAULT ${NOW},
  updated_at           TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS idx_internships_status_deadline ON internships(status, deadline);
CREATE INDEX IF NOT EXISTS idx_internships_recruiter ON internships(recruiter_id);

CREATE TABLE IF NOT EXISTS applications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  internship_id INTEGER NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_note    TEXT,
  resume_file   TEXT,
  resume_name   TEXT,
  status        TEXT NOT NULL DEFAULT 'Applied' CHECK (status IN (${statusList})),
  remarks       TEXT,
  created_at    TEXT NOT NULL DEFAULT ${NOW},
  updated_at    TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (internship_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);

CREATE TABLE IF NOT EXISTS status_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  remarks        TEXT,
  actor_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name     TEXT,
  actor_role     TEXT,
  changed_at     TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS idx_history_application ON status_history(application_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  link       TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS bookmarks (
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  internship_id INTEGER NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (user_id, internship_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES ('moderation_enabled', 'true');
`);

// node:sqlite cannot bind undefined or booleans.
const clean = (params) =>
  params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));

export const one = (sql, ...params) => db.prepare(sql).get(...clean(params));
export const all = (sql, ...params) => db.prepare(sql).all(...clean(params));
export const run = (sql, ...params) => {
  const result = db.prepare(sql).run(...clean(params));
  return { changes: Number(result.changes), id: Number(result.lastInsertRowid) };
};

let txDepth = 0;
export function tx(fn) {
  if (txDepth > 0) return fn();
  txDepth++;
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    txDepth--;
  }
}

export const nowIso = () => new Date().toISOString();

export function getSetting(key, fallback = null) {
  return one('SELECT value FROM settings WHERE key = ?', key)?.value ?? fallback;
}
export function setSetting(key, value) {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    String(value),
  );
}
export const isModerationEnabled = () => getSetting('moderation_enabled', 'true') === 'true';
