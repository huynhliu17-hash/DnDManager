const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const ALLOWED_FIELDS = ['name', 'tag', 'location', 'value', 'quantity', 'notes'];

router.use(requireAuth);

router.get('/money', (req, res) => {
  const row = db.prepare(`SELECT cp, sp, ep, gp, pp FROM party_money WHERE id = 1`).get();
  res.json(row || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
});

router.put('/money', (req, res) => {
  const fields = ['cp', 'sp', 'ep', 'gp', 'pp'];
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  const vals = {};
  fields.forEach(f => { vals[f] = parseInt(req.body[f]) || 0; });
  db.prepare(`UPDATE party_money SET ${sets} WHERE id = 1`).run(vals);
  res.json({ ok: true });
});

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT * FROM loot_items ORDER BY created_at ASC`).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const result = db.prepare(`
    INSERT INTO loot_items (name, tag, location, value, quantity, notes)
    VALUES ('', '', '', '', 1, '')
  `).run();
  const row = db.prepare(`SELECT * FROM loot_items WHERE id = ?`).get(result.lastInsertRowid);
  res.json(row);
});

router.put('/:id', (req, res) => {
  const updates = {};
  ALLOWED_FIELDS.forEach(f => {
    if (f in req.body) updates[f] = req.body[f];
  });
  if (Object.keys(updates).length === 0) return res.json({ ok: true });
  const sets = Object.keys(updates).map(f => `${f} = @${f}`).join(', ');
  updates.id = Number(req.params.id);
  db.prepare(`UPDATE loot_items SET ${sets} WHERE id = @id`).run(updates);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare(`DELETE FROM loot_items WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
