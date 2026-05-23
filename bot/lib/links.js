// readLinks()                              — read data/links.json; returns {} on missing/corrupt (exported)
// writeLinks(links)                        — write data/links.json
// getWebAppUserId(discordId)               — look up web app user ID for a Discord ID
// setLink(discordId, webAppUserId)         — save Discord → web app user ID mapping
// getActiveSheetId(discordId)              — look up active character sheet ID for a Discord ID
// setActiveSheetId(discordId, sheetId)     — save Discord → active sheet ID mapping
// verifyCredentials(username, password)    — POST /api/bot/verify-credentials

const fs = require('fs');
const path = require('path');
const { api } = require('./api');

const LINKS_FILE = path.join(__dirname, '..', 'data', 'links.json');
const ACTIVE_SHEETS_FILE = path.join(__dirname, '..', 'data', 'active_sheets.json');

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

function getActiveSheetId(discordId) {
  try {
    return JSON.parse(fs.readFileSync(ACTIVE_SHEETS_FILE, 'utf8'))[discordId] || null;
  } catch {
    return null;
  }
}

function setActiveSheetId(discordId, sheetId) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(ACTIVE_SHEETS_FILE, 'utf8')); } catch {}
  data[discordId] = String(sheetId);
  fs.writeFileSync(ACTIVE_SHEETS_FILE, JSON.stringify(data, null, 2));
}

async function verifyCredentials(username, password) {
  return api('/api/bot/verify-credentials', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

module.exports = { readLinks, getWebAppUserId, setLink, getActiveSheetId, setActiveSheetId, verifyCredentials };
