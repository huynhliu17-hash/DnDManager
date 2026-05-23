// readLinks()                           — read data/links.json; returns {} on missing/corrupt
// writeLinks(links)                     — write data/links.json
// getWebAppUserId(discordId)            — look up web app user ID for a Discord ID
// setLink(discordId, webAppUserId)      — save Discord → web app user ID mapping
// verifyCredentials(username, password) — POST /api/bot/verify-credentials

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

async function verifyCredentials(username, password) {
  return api('/api/bot/verify-credentials', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

module.exports = { getWebAppUserId, setLink, verifyCredentials };
