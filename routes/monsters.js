const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

const ALLOWED_FIELDS = ['name', 'ac', 'max_hp', 'current_hp', 'attacks'];

router.get('/', requireAdmin, (req, res) => {
  const userId = String(req.session.userId);
  const rows = db.prepare('SELECT id, name, ac, current_hp, max_hp FROM monsters WHERE user_id = ? ORDER BY name ASC').all(userId);
  res.json(rows);
});

router.post('/', requireAdmin, (req, res) => {
  const userId = String(req.session.userId);
  const result = db.prepare('INSERT INTO monsters (user_id) VALUES (?)').run(userId);
  const monster = db.prepare('SELECT * FROM monsters WHERE id = ?').get(result.lastInsertRowid);
  res.json(monster);
});

router.get('/:id', requireAdmin, (req, res) => {
  const userId = String(req.session.userId);
  const monster = db.prepare('SELECT * FROM monsters WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!monster) return res.status(404).json({ error: 'Not found' });
  res.json(monster);
});

router.put('/:id', requireAdmin, (req, res) => {
  const userId = String(req.session.userId);
  const existing = db.prepare('SELECT id FROM monsters WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) return res.json({ success: true });

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), req.params.id, userId];
  db.prepare(`UPDATE monsters SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(...values);
  res.json({ success: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const userId = String(req.session.userId);
  const result = db.prepare('DELETE FROM monsters WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;
