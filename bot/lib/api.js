// api(path, options, targetUserId) — fetch wrapper; injects bot API key + target user header

const WEBAPP_URL = process.env.WEBAPP_URL || 'http://localhost:3000';
const BOT_API_KEY = process.env.BOT_API_KEY;

async function api(path, options = {}, targetUserId = null) {
  const url = `${WEBAPP_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-bot-api-key': BOT_API_KEY,
    ...(targetUserId ? { 'x-target-user-id': String(targetUserId) } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options.method || 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

module.exports = { api };
