const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

router.post('/guest', (req, res) => {
  req.session.userId = 'guest';
  req.session.username = 'Guest';
  req.session.isAdmin = false;
  res.json({ success: true });
});

router.post('/register', async (req, res) => {
  const { password } = req.body;
  const username = req.body.username?.trim().toLowerCase();
  if (!username) return res.status(400).json({ error: 'Username required' });

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const hash = password ? await bcrypt.hash(password, 12) : null;
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  req.session.userId = result.lastInsertRowid;
  req.session.username = username;
  req.session.isAdmin = false;
  res.json({ success: true });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const username = req.body.username?.trim().toLowerCase();
  if (!username) return res.status(400).json({ error: 'Username required' });

  const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  if (user.password_hash) {
    if (!password) return res.status(401).json({ error: 'This account requires a password' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.isAdmin = user.is_admin === 1;
  res.json({ success: true });
});

router.post('/bot/verify-credentials', async (req, res) => {
  const key = req.headers['x-bot-api-key'];
  if (!key || key !== process.env.BOT_API_KEY) return res.status(403).json({ error: 'Forbidden' });

  const { password } = req.body;
  const username = req.body.username?.trim().toLowerCase();
  if (!username) return res.status(400).json({ error: 'Username required' });

  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE LOWER(username) = ?').get(username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.password_hash) {
    if (!password) return res.json({ valid: false, requiresPassword: true });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.json({ valid: false, requiresPassword: true });
  }

  res.json({ valid: true, requiresPassword: !!user.password_hash, userId: user.id, username: user.username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  res.json({ username: req.session.username, guest: req.session.userId === 'guest', admin: !!req.session.isAdmin });
});

module.exports = router;
