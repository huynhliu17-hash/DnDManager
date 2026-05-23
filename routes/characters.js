const express = require('express');
const db = require('../db');
const { requireAuth, requireBotOrAuth, callerId, callerName } = require('../middleware/auth');
const { logHistory } = require('../lib/history');
const router = express.Router();

const ALLOWED_FIELDS = [
  'character_name','class_level','background','player_name','race','alignment','experience_points',
  'inspiration','proficiency_bonus','rage_uses','superiority_dice',
  'strength','dexterity','constitution','intelligence','wisdom','charisma',
  'save_str','save_dex','save_con','save_int','save_wis','save_cha',
  'skill_acrobatics','skill_animal_handling','skill_arcana','skill_athletics','skill_deception',
  'skill_history','skill_insight','skill_intimidation','skill_investigation','skill_medicine',
  'skill_nature','skill_perception','skill_performance','skill_persuasion','skill_religion',
  'skill_sleight_of_hand','skill_stealth','skill_survival',
  'armor_class','initiative','speed','max_hp','current_hp','temp_hp','hit_dice',
  'death_save_success','death_save_fail',
  'attacks','spells','spell_slots','conditions','cp','sp','ep','gp','pp','equipment',
  'personality_traits','ideals','bonds','flaws','features_traits',
  'backstory','allies_organizations','additional_features','treasure'
];

router.get('/', requireAuth, (req, res) => {
  const userId = String(req.session.userId);
  const rows = db.prepare('SELECT id, character_name, class_level, race, updated_at FROM character_sheets WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const userId = String(req.session.userId);
  const result = db.prepare('INSERT INTO character_sheets (user_id) VALUES (?)').run(userId);
  const sheet = db.prepare('SELECT * FROM character_sheets WHERE id = ?').get(result.lastInsertRowid);
  logHistory(req.session.userId, req.session.username, 'create', {
    item_id: sheet.id,
    item_name: sheet.character_name || '',
    source: 'sheet',
  });
  res.json(sheet);
});

router.get('/:id', requireAuth, (req, res) => {
  const userId = String(req.session.userId);
  const sheet = db.prepare('SELECT * FROM character_sheets WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!sheet) return res.status(404).json({ error: 'Not found' });
  res.json(sheet);
});

router.put('/:id', requireBotOrAuth, (req, res) => {
  const userId = req.botCaller && req.headers['x-target-user-id']
    ? String(req.headers['x-target-user-id'])
    : callerId(req);
  const old = db.prepare('SELECT * FROM character_sheets WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!old) return res.status(404).json({ error: 'Not found' });

  const updates = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in req.body) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) return res.json({ success: true });

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(updates), req.params.id, userId];
  db.prepare(`UPDATE character_sheets SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`).run(...values);

  for (const f of Object.keys(updates)) {
    const ov = String(old[f] ?? '');
    const nv = String(updates[f] ?? '');
    if (ov !== nv) {
      logHistory(callerId(req), callerName(req), 'update', {
        item_id: old.id,
        item_name: updates.character_name ?? old.character_name ?? '',
        field: f,
        old_val: ov,
        new_val: nv,
        source: 'sheet',
      });
    }
  }

  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const userId = String(req.session.userId);
  const old = db.prepare('SELECT id, character_name FROM character_sheets WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!old) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM character_sheets WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  logHistory(req.session.userId, req.session.username, 'delete', {
    item_id: old.id,
    item_name: old.character_name || '',
    source: 'sheet',
  });
  res.json({ success: true });
});

module.exports = router;
