// Run once (or to refresh): node scripts/seed-dnd-index.js
// Writes bot/data/dnd5e-index.json — required before starting the bot.

const fs = require('fs');
const path = require('path');

const BASE = 'https://www.dnd5eapi.co';
const TYPES = ['spells', 'feats', 'features'];
const OUT = path.join(__dirname, '../data/dnd5e-index.json');

async function fetchList(type) {
  const res = await fetch(`${BASE}/api/${type}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type}: ${res.status}`);
  const data = await res.json();
  return data.results;
}

async function main() {
  const index = {};
  for (const type of TYPES) {
    process.stdout.write(`Fetching ${type}...`);
    index[type] = await fetchList(type);
    console.log(` ${index[type].length} entries`);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index));
  console.log(`Written to ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
