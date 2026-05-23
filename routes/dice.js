const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireBotOrAuth } = require('../middleware/auth');
const router = express.Router();

const VALID_DICE = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

const BIT_NOISE1 = 0xB5297A4Dn;
const BIT_NOISE2 = 0x68E31DA4n;
const BIT_NOISE3 = 0x1B56C4E9n;
const MASK32 = 0xFFFFFFFFn;

// Squirrel noise: stateless hash-based white noise, seedable and position-indexed.
// Each (position, seed) pair maps to a unique uniformly-distributed value.
function squirrelNoise(position, seed) {
  let n = (BigInt(position) * BIT_NOISE1 + BigInt(seed)) & MASK32;
  n = (n ^ (n >> 8n)) & MASK32;
  n = (n + BIT_NOISE2) & MASK32;
  n = (n ^ (n << 8n)) & MASK32;
  n = (n * BIT_NOISE3) & MASK32;
  n = (n ^ (n >> 8n)) & MASK32;
  return n;
}

function rollDie(faces, index, seed) {
  return Number(squirrelNoise(index, seed) % BigInt(faces)) + 1;
}

router.post('/roll', requireBotOrAuth, (req, res) => {
  const { diceType, count } = req.body;
  const faces = VALID_DICE[diceType];
  if (!faces) return res.status(400).json({ error: 'Invalid dice type' });

  const diceCount = parseInt(count, 10);
  if (!Number.isInteger(diceCount) || diceCount < 1 || diceCount > 20) {
    return res.status(400).json({ error: 'Count must be between 1 and 20' });
  }

  // Seed from OS entropy + nanosecond time for maximum unpredictability per batch
  const entropyBytes = crypto.randomBytes(4);
  const seed = entropyBytes.readUInt32BE(0) ^ Number(process.hrtime.bigint() & 0xFFFFFFFFn);

  const results = Array.from({ length: diceCount }, (_, i) => rollDie(faces, i, seed));
  const total = results.reduce((a, b) => a + b, 0);
  const userId = String(req.session.userId);
  const username = req.session.username || 'Guest';

  const row = db.prepare(
    'INSERT INTO dice_rolls (user_id, username, dice_type, dice_count, results, total) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(userId, username, diceType, diceCount, JSON.stringify(results), total);

  res.json({ id: row.lastInsertRowid, diceType, diceCount, results, total });
});

router.get('/users', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT username FROM dice_rolls ORDER BY username ASC').all();
  res.json(rows.map(r => r.username));
});

router.get('/rolls', requireAuth, (req, res) => {
  const { user } = req.query;
  const rolls = user
    ? db.prepare('SELECT id, username, dice_type, dice_count, results, total, rolled_at FROM dice_rolls WHERE username = ? ORDER BY id DESC LIMIT 10').all(user)
    : db.prepare('SELECT id, username, dice_type, dice_count, results, total, rolled_at FROM dice_rolls ORDER BY id DESC LIMIT 10').all();

  res.json(rolls.map(r => ({ ...r, results: JSON.parse(r.results) })));
});

module.exports = router;
