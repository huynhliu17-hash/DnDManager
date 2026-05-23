// Run once (or to refresh): node scripts/seed-dnd-index.js
// Writes bot/data/dnd5e-index.json — required before starting the bot.

const fs = require('fs');
const path = require('path');

const DND5E_BASE = 'https://www.dnd5eapi.co';
const OPEN5E_BASE = 'https://api.open5e.com';
const DND5E_TYPES = ['spells', 'features'];
const OUT = path.join(__dirname, '../data/dnd5e-index.json');

async function fetchDnd5eList(type) {
  const res = await fetch(`${DND5E_BASE}/api/${type}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type}: ${res.status}`);
  const data = await res.json();
  return data.results;
}

async function fetchOpen5eFeats() {
  const results = [];
  let url = `${OPEN5E_BASE}/v1/feats/?format=json&limit=500`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch feats from Open5e: ${res.status}`);
    const data = await res.json();
    results.push(...data.results);
    url = data.next;
  }
  return results.map(f => ({ name: f.name, url: `/v1/feats/${f.slug}/` }));
}

async function main() {
  const index = {};
  for (const type of DND5E_TYPES) {
    process.stdout.write(`Fetching ${type}...`);
    index[type] = await fetchDnd5eList(type);
    console.log(` ${index[type].length} entries`);
  }
  process.stdout.write('Fetching feats (Open5e)...');
  index.feats = await fetchOpen5eFeats();
  console.log(` ${index.feats.length} entries`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(index));
  console.log(`Written to ${OUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
