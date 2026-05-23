const fs = require('fs');
const path = require('path');
const { api } = require('./api');

const LINKS_FILE = path.join(__dirname, '..', 'data', 'links.json');

function readLinks() {
  try {
    return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeLinks(links) {
  fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2));
}

function getWebAppUserId(discordId) {
  return readLinks()[discordId] || null;
}

function setLink(discordId, webAppUserId) {
  const links = readLinks();
  links[discordId] = String(webAppUserId);
  writeLinks(links);
}

async function resolveUsername(name) {
  const players = await api('/api/players');
  const match = players.find(p => p.username.toLowerCase() === name.toLowerCase());
  return match || null;
}

module.exports = { getWebAppUserId, setLink, resolveUsername };
