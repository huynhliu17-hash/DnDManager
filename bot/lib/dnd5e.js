// loadIndex() — read cached dnd5e-index.json (lazy, cached in memory)
// fuzzySearch(type, query, limit) — substring match on name; starts-with ranked first
// fetchDetail(url) — GET full detail object from 5e API

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '../data/dnd5e-index.json');
const BASE = 'https://www.dnd5eapi.co';

let _index = null;

function loadIndex() {
  if (!_index) _index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  return _index;
}

function fuzzySearch(type, query, limit = 25) {
  const list = loadIndex()[type] || [];
  if (!query) return list.slice(0, limit);
  const q = query.toLowerCase();
  const starts = list.filter(e => e.name.toLowerCase().startsWith(q));
  const contains = list.filter(e => !e.name.toLowerCase().startsWith(q) && e.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

async function fetchDetail(url) {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`5e API error: ${res.status}`);
  return res.json();
}

module.exports = { loadIndex, fuzzySearch, fetchDetail };
