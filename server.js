// server.js — AFC (Allfor Care Medical & Ambulance Services) backend.
// Zero external dependencies: uses only Node's built-in http, fs, path, and
// node:sqlite modules, so `npm install` is not required to run this.
// Requires Node.js 22.5 or newer (for node:sqlite).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const PAYMENT_BASE_URL = (process.env.PAYMENT_BASE_URL || '').replace(/\/$/, '');

const RESOURCES = {
  bookings: { table: 'bookings', statuses: ['requested', 'confirmed', 'completed', 'cancelled'] },
  sos: { table: 'sos_requests', statuses: ['request_received', 'dispatched', 'en_route', 'arrived', 'completed', 'cancelled'] },
  membership: { table: 'memberships', statuses: ['pending_payment', 'active', 'cancelled'] },
};

// ---------- tiny helpers ----------

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = '';
    req.on('data', (c) => {
      chunks += c;
      if (chunks.length > 1_000_000) req.destroy(); // 1MB guard
    });
    req.on('end', () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function missingFields(body, fields) {
  return fields.filter((f) => !body[f] || String(body[f]).trim() === '');
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    sendJSON(res, 503, { error: 'Admin API is not configured' });
    return false;
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-admin-token'];
  if (token !== ADMIN_TOKEN) {
    sendJSON(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  // prevent path traversal outside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    });
    res.end(data);
  });
}

// ---------- API routes ----------

async function handleApi(req, res, pathname) {
  // Admin dashboard: update the status of a booking / SOS request / membership
  const idMatch = pathname.match(/^\/api\/(bookings|sos|membership)\/(\d+)$/);
  if (idMatch && req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return;
    const resource = RESOURCES[idMatch[1]];
    const id = Number(idMatch[2]);
    const body = await readBody(req);
    if (!resource.statuses.includes(body.status)) {
      return sendJSON(res, 400, { error: 'Invalid status', allowed: resource.statuses });
    }
    const result = db.prepare(`UPDATE ${resource.table} SET status = ? WHERE id = ?`).run(body.status, id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Not found' });
    const row = db.prepare(`SELECT * FROM ${resource.table} WHERE id = ?`).get(id);
    return sendJSON(res, 200, row);
  }

  // Admin dashboard: verify a token without fetching data
  if (pathname === '/api/admin/verify' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return sendJSON(res, 200, { ok: true });
  }

  // Bookings — doctor / nurse / aide / medication / scheduled ambulance transport
  if (pathname === '/api/bookings' && req.method === 'POST') {
    const body = await readBody(req);
    const required = ['service', 'name', 'phone'];
    if (body.service_key === 'ambulance') {
      required.push('staff_needed', 'mobility', 'pickup', 'dropoff');
    } else {
      required.push('date', 'time');
    }
    const missing = missingFields(body, required);
    if (missing.length) return sendJSON(res, 400, { error: 'Missing fields', missing });

    const stmt = db.prepare(`
      INSERT INTO bookings
        (service, service_key, name, phone, email, date, time, address, pickup, dropoff,
         staff_needed, mobility, payment_method, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const result = stmt.run(
      body.service, body.service_key || null, body.name, body.phone, body.email || null,
      body.date || null, body.time || null, body.address || null, body.pickup || null,
      body.dropoff || null, body.staff_needed || null, body.mobility || null,
      body.payment_method || null, body.notes || null
    );
    return sendJSON(res, 201, { id: result.lastInsertRowid, status: 'requested' });
  }

  if (pathname === '/api/bookings' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const rows = db.prepare('SELECT * FROM bookings ORDER BY id DESC').all();
    return sendJSON(res, 200, rows);
  }

  // Emergency SOS ambulance requests
  if (pathname === '/api/sos' && req.method === 'POST') {
    const body = await readBody(req);
    const missing = missingFields(body, ['phone', 'address', 'staff_needed', 'mobility']);
    if (missing.length) return sendJSON(res, 400, { error: 'Missing fields', missing });

    const stmt = db.prepare(`
      INSERT INTO sos_requests (phone, email, address, dropoff, staff_needed, mobility, payment_method, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    const result = stmt.run(
      body.phone, body.email || null, body.address, body.dropoff || null,
      body.staff_needed, body.mobility, body.payment_method || null, body.notes || null
    );
    // This records the request. A live dispatch integration must confirm a crew/ETA.
    return sendJSON(res, 201, {
      id: result.lastInsertRowid,
      status: 'request_received',
      message: 'Dispatch request received. Call the dispatch line if you need immediate confirmation.',
    });
  }

  if (pathname === '/api/sos' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const rows = db.prepare('SELECT * FROM sos_requests ORDER BY id DESC').all();
    return sendJSON(res, 200, rows);
  }

  // Membership signups
  if (pathname === '/api/membership' && req.method === 'POST') {
    const body = await readBody(req);
    const missing = missingFields(body, ['plan', 'price', 'name', 'phone']);
    if (missing.length) return sendJSON(res, 400, { error: 'Missing fields', missing });

    const stmt = db.prepare(`
      INSERT INTO memberships (plan, price, name, phone, email, address)
      VALUES (?,?,?,?,?,?)
    `);
    const result = stmt.run(
      body.plan, body.price, body.name, body.phone, body.email || null, body.address || null
    );
    const payUrl = PAYMENT_BASE_URL
      ? `${PAYMENT_BASE_URL}/membership?ref=${result.lastInsertRowid}&plan=${encodeURIComponent(body.plan)}`
      : null;
    return sendJSON(res, 201, { id: result.lastInsertRowid, status: 'pending_payment', pay_url: payUrl });
  }

  if (pathname === '/api/membership' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const rows = db.prepare('SELECT * FROM memberships ORDER BY id DESC').all();
    return sendJSON(res, 200, rows);
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, time: new Date().toISOString() });
  }

  sendJSON(res, 404, { error: 'Not found' });
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    });
    return res.end();
  }

  if (pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, pathname);
    } catch (err) {
      console.error(err);
      sendJSON(res, 400, { error: 'Bad request', detail: err.message });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`AFC backend running at http://localhost:${PORT}`);
  console.log(`  Frontend:      http://localhost:${PORT}/`);
  console.log(`  API health:    http://localhost:${PORT}/api/health`);
});
