require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

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

// ========================
// ORDER EMAIL NOTIFICATION
// ========================
app.post('/api/notify-order', async (req, res) => {
  try {
    const { orderNumber, customerName, customerPhone, customerAddress, items, total } = req.body;

    if (!transporter) {
      return res.status(200).json({ message: 'Email not configured, skipping notification' });
    }

    // Build the items list for the email
    let itemsHtml = '';
    if (items && items.length > 0) {
      itemsHtml = items.map(item =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${item.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">₵${(item.price * item.qty).toFixed(2)}</td>
        </tr>`
      ).join('');
    }

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0">
        <div style="background:linear-gradient(135deg,#2d5016,#4a7c24);padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">🐔 New Order — Anvica Farms</h1>
        </div>
        <div style="padding:24px">
          <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:20px;border-left:4px solid #4a7c24">
            <h2 style="margin:0 0 4px;color:#2d5016;font-size:18px">Order ${orderNumber}</h2>
            <p style="margin:0;color:#666;font-size:14px">Placed just now</p>
          </div>

          <h3 style="color:#333;font-size:16px;margin-bottom:8px">📋 Customer Details</h3>
          <table style="width:100%;margin-bottom:20px;font-size:14px">
            <tr><td style="padding:4px 0;color:#666;width:100px"><strong>Name:</strong></td><td>${customerName}</td></tr>
            <tr><td style="padding:4px 0;color:#666"><strong>Phone:</strong></td><td>${customerPhone}</td></tr>
            <tr><td style="padding:4px 0;color:#666"><strong>Address:</strong></td><td>${customerAddress}</td></tr>
          </table>

          <h3 style="color:#333;font-size:16px;margin-bottom:8px">🛒 Order Items</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Item</th>
                <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e5e7eb">Qty</th>
                <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e5e7eb">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:right">
            <span style="font-size:18px;font-weight:bold;color:#2d5016">Total: ₵${total.toFixed(2)}</span>
          </div>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;color:#999;font-size:12px">
          Anvica Farms — Amasaman, Accra, Ghana | +233 55 582 4836
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Anvica Farms" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `🐔 New Order ${orderNumber} — ₵${total.toFixed(2)}`,
      html: emailHtml,
    });

    console.log(`📧 Order email sent for ${orderNumber}`);
    res.json({ message: 'Email notification sent' });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// ========================
// CATCH-ALL — serve index.html
// ========================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
app.listen(PORT, () => console.log(`🐔 Anvica Farms Server running at http://localhost:${PORT}`));