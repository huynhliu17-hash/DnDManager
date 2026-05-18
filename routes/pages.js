const express = require('express');
const path = require('path');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

router.get('/character-sheet', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'character-sheet.html'));
});

router.get('/monsters', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'monsters.html'));
});

router.get('/dice-roll', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dice-roll.html'));
});

router.get('/loot', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'loot.html'));
});

module.exports = router;
