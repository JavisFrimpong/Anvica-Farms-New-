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

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'anvica-default-secret';
const DB_PATH = path.join(__dirname, 'database.db');

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create images directory
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// --- Multer Config (Image Upload) ---
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
    const extOk = allowedExts.test(path.extname(file.originalname));
    const mimeOk = allowedMimes.test(file.mimetype);
    if (extOk || mimeOk) {
      cb(null, true);
    } else {
      console.error('Rejected file:', file.originalname, file.mimetype);
      cb(null, false);
    }
  }
});

// --- Database ---
let db;

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

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

  saveDB();
  console.log('  📦 Database initialized');
}

// Helper to query rows
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
}

// --- Email Transporter ---
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_PASS !== 'your-gmail-app-password-here') {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  // Verify connection on startup
  transporter.verify((error, success) => {
    if (error) {
      console.error('  ❌ Email setup FAILED:', error.message);
      console.error('     Check your EMAIL_USER and EMAIL_PASS in .env');
    } else {
      console.log('  ✅ Email notifications enabled — sending to', process.env.EMAIL_USER);
    }
  });
} else {
  console.log('  ⚠️  Email not configured — set EMAIL_USER and EMAIL_PASS in .env');
}

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminId = decoded.id;
    req.adminUsername = decoded.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Generate Order Number ---
function generateOrderNumber() {
  const lastOrder = queryOne('SELECT order_number FROM orders ORDER BY id DESC LIMIT 1');
  if (!lastOrder) return 'ANV-0001';
  const lastNum = parseInt(lastOrder.order_number.split('-')[1]);
  return `ANV-${String(lastNum + 1).padStart(4, '0')}`;
}

// ========================
// AUTH ROUTES
// ========================

app.post('/api/admin/signup', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = queryOne('SELECT id FROM admin_users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hashed = bcrypt.hashSync(password, 10);
    const result = runSql('INSERT INTO admin_users (username, password) VALUES (?, ?)', [username, hashed]);
    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    const user = queryOne('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================
// PRODUCT ROUTES
// ========================

app.get('/api/products', (req, res) => {
  try {
    const products = queryAll('SELECT * FROM products ORDER BY created_at DESC');
    res.json(products);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', authMiddleware, upload.single('image'), (req, res) => {
  try {
    const { name, description, price, category, in_stock } = req.body;
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const result = runSql(
      'INSERT INTO products (name, description, price, category, image, in_stock) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', parseFloat(price), category || 'General', image, in_stock !== undefined ? parseInt(in_stock) : 1]
    );
    const product = queryOne('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    res.json(product);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/products/:id', authMiddleware, upload.single('image'), (req, res) => {
  try {
    const { name, description, price, category, in_stock } = req.body;
    const existing = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const image = req.file ? `/uploads/${req.file.filename}` : existing.image;

    if (req.file && existing.image) {
      const oldPath = path.join(__dirname, 'public', existing.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    runSql(
      'UPDATE products SET name = ?, description = ?, price = ?, category = ?, image = ?, in_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [
        name || existing.name,
        description !== undefined ? description : existing.description,
        price ? parseFloat(price) : existing.price,
        category || existing.category,
        image,
        in_stock !== undefined ? parseInt(in_stock) : existing.in_stock,
        parseInt(req.params.id)
      ]
    );
    const product = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    res.json(product);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(req.params.id)]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    if (existing.image) {
      const imgPath = path.join(__dirname, 'public', existing.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    runSql('DELETE FROM products WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================
// ORDER ROUTES
// ========================

app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerPhone, customerAddress, items } = req.body;

    if (!customerName || !customerPhone || !customerAddress || !items || !items.length) {
      return res.status(400).json({ error: 'All customer details and at least one item are required' });
    }

    const orderNumber = generateOrderNumber();
    let total = 0;

    const validatedItems = items.map(item => {
      const product = queryOne('SELECT * FROM products WHERE id = ?', [parseInt(item.productId)]);
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      const itemTotal = product.price * item.quantity;
      total += itemTotal;
      return {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity
      };
    });

    const orderResult = runSql(
      'INSERT INTO orders (order_number, customer_name, customer_phone, customer_address, total) VALUES (?, ?, ?, ?, ?)',
      [orderNumber, customerName, customerPhone, customerAddress, total]
    );

    for (const item of validatedItems) {
      runSql(
        'INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderResult.lastInsertRowid, item.productId, item.productName, item.price, item.quantity]
      );
    }

    // Send email notification
    if (transporter) {
      const itemsHtml = validatedItems.map(item =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${item.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₵${item.price.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₵${(item.price * item.quantity).toFixed(2)}</td>
        </tr>`
      ).join('');

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#2d5016;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0">
            <img src="cid:anvicalogo" alt="Anvica Farms" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin-bottom:8px">
            <h1 style="margin:0">Anvica Farms</h1>
            <h2 style="margin:5px 0 0;font-weight:normal">New Order Received!</h2>
          </div>
          <div style="padding:20px;background:#f9f9f9;border:1px solid #ddd">
            <h3 style="color:#2d5016">Order #${orderNumber}</h3>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Phone:</strong> ${customerPhone}</p>
            <p><strong>Delivery Address:</strong> ${customerAddress}</p>
            <table style="width:100%;border-collapse:collapse;margin:15px 0">
              <thead>
                <tr style="background:#2d5016;color:white">
                  <th style="padding:10px;text-align:left">Product</th>
                  <th style="padding:10px;text-align:center">Qty</th>
                  <th style="padding:10px;text-align:right">Price</th>
                  <th style="padding:10px;text-align:right">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                <tr style="background:#f0f0f0">
                  <td colspan="3" style="padding:10px;text-align:right;font-weight:bold">Total:</td>
                  <td style="padding:10px;text-align:right;font-weight:bold;color:#2d5016">₵${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style="text-align:center;padding:15px;color:#666;font-size:12px">
            Anvica Farms — Fresh Poultry, Always
          </div>
        </div>
      `;

      try {
        await transporter.sendMail({
          from: `"Anvica Farms" <${process.env.EMAIL_USER}>`,
          to: 'marksspe.20@gmail.com',
          subject: `Anvica Farms — New Order ${orderNumber} from ${customerName}`,
          html: emailHtml,
          attachments: [{
            filename: 'logo.png',
            path: path.join(__dirname, 'public', 'images', 'logo.png'),
            cid: 'anvicalogo'
          }]
        });
      } catch (emailErr) {
        console.error('Email sending failed:', emailErr.message);
      }
    }

    res.json({ orderNumber, total });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.get('/api/orders', authMiddleware, (req, res) => {
  try {
    const orders = queryAll('SELECT * FROM orders ORDER BY id DESC');
    const ordersWithItems = orders.map(order => {
      const items = queryAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      return { ...order, items };
    });
    res.json(ordersWithItems);
  } catch (err) {
    console.error('Get orders error:', err);
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
  app.listen(PORT, () => {
    console.log(`\n  🐔 Anvica Farms Server running at http://localhost:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
