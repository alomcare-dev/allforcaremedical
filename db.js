// db.js — database setup using Node's built-in SQLite (node:sqlite).
// Requires Node.js 22.5+. No npm install needed for the database layer.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'afc.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    service TEXT NOT NULL,
    service_key TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    date TEXT,
    time TEXT,
    address TEXT,
    pickup TEXT,
    dropoff TEXT,
    staff_needed TEXT,
    mobility TEXT,
    payment_method TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'requested'
  );

  CREATE TABLE IF NOT EXISTS sos_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    dropoff TEXT,
    staff_needed TEXT,
    mobility TEXT,
    payment_method TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'request_received'
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    plan TEXT NOT NULL,
    price TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'pending_payment'
  );
`);

module.exports = db;
