const express = require('express');
const db = require('../db');
const { requireBotOrAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireBotOrAuth, (req, res) => {
  const userId = String(req.session.userId);
  if (userId === 'guest') return res.json([]);
  const rows = db.prepare('SELECT id, username FROM users WHERE id != ? ORDER BY username').all(userId);
  res.json(rows);
});

router.get('/:userId/characters', requireBotOrAuth, (req, res) => {
  const rows = db.prepare('SELECT id, character_name, class_level, race FROM character_sheets WHERE user_id = ? ORDER BY updated_at DESC').all(req.params.userId);
  res.json(rows);
});

router.get('/:userId/characters/:charId', requireBotOrAuth, (req, res) => {
  const sheet = db.prepare('SELECT * FROM character_sheets WHERE id = ? AND user_id = ?').get(req.params.charId, req.params.userId);
  if (!sheet) return res.status(404).json({ error: 'Not found' });
  res.json(sheet);
});

module.exports = router;
