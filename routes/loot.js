const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logHistory } = require('../lib/history');
const router = express.Router();

const ALLOWED_FIELDS = ['name', 'tag', 'location', 'value', 'quantity', 'notes'];

router.use(requireAuth);

router.get('/history', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, username, action, item_id, item_name, field, old_val, new_val, source, ts
    FROM loot_history ORDER BY ts DESC LIMIT 500
  `).all();
  res.json(rows);
});

router.get('/money', (req, res) => {
  const row = db.prepare(`SELECT cp, sp, ep, gp, pp FROM party_money WHERE id = 1`).get();
  res.json(row || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
});

router.put('/money', (req, res) => {
  const fields = ['cp', 'sp', 'ep', 'gp', 'pp'];
  const old = db.prepare(`SELECT cp, sp, ep, gp, pp FROM party_money WHERE id = 1`).get() || {};
  const vals = {};
  fields.forEach(f => { vals[f] = parseInt(req.body[f]) || 0; });
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE party_money SET ${sets} WHERE id = 1`).run(vals);
  fields.forEach(f => {
    if ((old[f] ?? 0) !== vals[f]) {
      logHistory(req.session.userId, req.session.username, 'money', {
        field: f,
        old_val: String(old[f] ?? 0),
        new_val: String(vals[f]),
      });
    }
  });
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
  logHistory(req.session.userId, req.session.username, 'create', {
    item_id: row.id,
    item_name: row.name,
  });
  res.json(row);
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const updates = {};
  ALLOWED_FIELDS.forEach(f => {
    if (f in req.body) updates[f] = req.body[f];
  });
  if (Object.keys(updates).length === 0) return res.json({ ok: true });
  const old = db.prepare(`SELECT * FROM loot_items WHERE id = ?`).get(id);
  const sets = Object.keys(updates).map(f => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE loot_items SET ${sets} WHERE id = @id`).run({ ...updates, id });
  if (old) {
    for (const f of Object.keys(updates)) {
      const ov = String(old[f] ?? '');
      const nv = String(updates[f] ?? '');
      if (ov !== nv) {
        logHistory(req.session.userId, req.session.username, 'update', {
          item_id: id,
          item_name: old.name || '',
          field: f,
          old_val: ov,
          new_val: nv,
        });
      }
    }
  }
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare(`SELECT name FROM loot_items WHERE id = ?`).get(id);
  db.prepare(`DELETE FROM loot_items WHERE id = ?`).run(id);
  logHistory(req.session.userId, req.session.username, 'delete', {
    item_id: id,
    item_name: old?.name || '',
  });
  res.json({ ok: true });
});

module.exports = router;
