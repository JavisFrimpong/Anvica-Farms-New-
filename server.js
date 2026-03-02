require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const initSqlJs = require('sql.js');
const { kv } = require('@vercel/kv'); // Vercel KV for persistence

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'anvica-default-secret';
const DB_KEY = 'anvica-db'; // KV key to store DB

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads/images directories exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const imagesDir = path.join(__dirname, 'public', 'images');
[uploadsDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- Multer Config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = /\.(jpeg|jpg|png|gif|webp)$/i;
    const allowedMimes = /^image\/(jpeg|jpg|png|gif|webp)$/i;
    if (allowedExts.test(path.extname(file.originalname)) || allowedMimes.test(file.mimetype)) {
      cb(null, true);
    } else {
      console.error('Rejected file:', file.originalname, file.mimetype);
      cb(null, false);
    }
  }
});

// --- Database ---
let db;

async function saveDB() {
  const data = db.export();
  const base64 = Buffer.from(data).toString('base64');
  await kv.set(DB_KEY, base64);
}

async function initDB() {
  const SQL = await initSqlJs({
    locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/${file}`,
  });

  // Load DB from KV or initialize new
  const storedDB = await kv.get(DB_KEY);
  if (storedDB) {
    db = new SQL.Database(Buffer.from(storedDB, 'base64'));
    console.log('📦 Loaded DB from KV');
  } else {
    db = new SQL.Database();
    console.log('📦 Initialized new DB');

    db.run(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        category TEXT DEFAULT 'General',
        image TEXT,
        in_stock INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )
    `);

    await saveDB();
  }
}

// --- Helper Functions ---
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length ? results[0] : null;
}

async function runSql(sql, params = []) {
  db.run(sql, params);
  await saveDB();
  const lastRowId = db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0];
  return { lastInsertRowid: lastRowId };
}

// --- Email Transporter ---
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'your-gmail-app-password-here') {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  transporter.verify((err, success) => {
    if (err) console.error('❌ Email setup FAILED:', err.message);
    else console.log('✅ Email notifications enabled — sending to', process.env.EMAIL_USER);
  });
} else {
  console.log('⚠️ Email not configured — set EMAIL_USER and EMAIL_PASS in .env');
}

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminId = decoded.id;
    req.adminUsername = decoded.username;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// --- Generate Order Number ---
function generateOrderNumber() {
  const lastOrder = queryOne('SELECT order_number FROM orders ORDER BY id DESC LIMIT 1');
  if (!lastOrder) return 'ANV-0001';
  const lastNum = parseInt(lastOrder.order_number.split('-')[1]);
  return `ANV-${String(lastNum + 1).padStart(4, '0')}`;
}

// ========================
// ROUTES (AUTH / PRODUCTS / ORDERS) - keep your existing routes here
// All `runSql()` calls are now async for KV persistence
// ========================

// Example for signup route:
app.post('/api/admin/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 chars' });
    const existing = queryOne('SELECT id FROM admin_users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Username exists' });
    const hashed = bcrypt.hashSync(password, 10);
    const result = await runSql('INSERT INTO admin_users (username, password) VALUES (?, ?)', [username, hashed]);
    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================
// CATCH-ALL
// ========================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`🐔 Anvica Farms Server running at http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});