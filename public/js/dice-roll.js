let selectedType = 'd20';
let diceCount = 1;
let cachedRolls = [];
let activeFilter = null;

fetch('/api/me').then(r => r.json()).then(data => {
  if (!data.username) { window.location.href = '/login.html'; return; }
  document.getElementById('nav-username').textContent = data.username;
  if (data.admin) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
});

document.getElementById('dice-type-group').addEventListener('click', e => {
  const btn = e.target.closest('.dice-type-btn');
  if (!btn) return;
  document.querySelectorAll('.dice-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedType = btn.dataset.type;
});

function adjustCount(delta) {
  diceCount = Math.min(20, Math.max(1, diceCount + delta));
  document.getElementById('dice-count').value = diceCount;
  syncCountButtons();
}

function syncCountButtons() {
  document.getElementById('count-dec').disabled = diceCount <= 1;
  document.getElementById('count-inc').disabled = diceCount >= 20;
}

document.getElementById('dice-count').addEventListener('input', e => {
  const val = parseInt(e.target.value, 10);
  if (!isNaN(val)) {
    diceCount = Math.min(20, Math.max(1, val));
    e.target.value = diceCount;
  }
  syncCountButtons();
});

async function rollDice() {
  const btn = document.getElementById('roll-btn');
  btn.disabled = true;
  btn.textContent = 'Rolling…';

  try {
    const res = await fetch('/api/dice/roll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diceType: selectedType, count: diceCount })
    });
    if (!res.ok) throw new Error('Roll failed');
    const data = await res.json();
    showResult(data);
    loadFilterUsers();
    loadHistory();
  } catch {
    // silently ignore
  } finally {
    btn.disabled = false;
    btn.textContent = 'Roll';
  }
}

function showResult(data) {
  const resultEl = document.getElementById('dice-result');
  const exprEl = document.getElementById('result-expr');
  const diceEl = document.getElementById('result-dice');
  const totalEl = document.getElementById('result-total');

  exprEl.textContent = `${data.diceCount}${data.diceType}`;

  diceEl.innerHTML = data.results.map(v => {
    const faces = parseInt(data.diceType.slice(1), 10);
    const cls = v === faces ? 'die-max' : v === 1 ? 'die-min' : '';
    return `<span class="die-pip ${cls}">${v}</span>`;
  }).join('');

  totalEl.textContent = data.diceCount > 1 ? `= ${data.total}` : '';

  resultEl.classList.remove('hidden');
  resultEl.classList.add('result-flash');
  setTimeout(() => resultEl.classList.remove('result-flash'), 400);
}

async function loadHistory() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.disabled = true;

  try {
    const url = activeFilter
      ? `/api/dice/rolls?user=${encodeURIComponent(activeFilter)}`
      : '/api/dice/rolls';
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const rolls = await res.json();
    renderHistory(rolls);
  } catch {
    // silently ignore
  } finally {
    refreshBtn.disabled = false;
  }
}

async function loadFilterUsers() {
  try {
    const res = await fetch('/api/dice/users');
    if (!res.ok) throw new Error();
    const usernames = await res.json();
    const select = document.getElementById('history-user-select');
    const current = select.value;
    select.innerHTML = '<option value="">All players</option>' +
      usernames.map(u => `<option value="${escHtml(u)}"${u === current ? ' selected' : ''}>${escHtml(u)}</option>`).join('');
  } catch {
    // silently ignore
  }
}

function onFilterChange(value) {
  activeFilter = value || null;
  loadHistory();
}

function renderHistory(rolls) {
  const tbody = document.getElementById('history-body');
  if (rolls.length === 0) {
    const msg = activeFilter ? `${escHtml(activeFilter)} has no roll history.` : 'No rolls yet.';
    tbody.innerHTML = `<tr><td colspan="5" class="history-empty">${msg}</td></tr>`;
    return;
  }
  tbody.innerHTML = rolls.map(r => `
    <tr>
      <td class="history-user">${escHtml(r.username)}</td>
      <td class="history-roll">${r.dice_count}${escHtml(r.dice_type)}</td>
      <td class="history-results">${r.results.map(v => `<span class="die-pip-sm">${v}</span>`).join('')}</td>
      <td class="history-total">${r.total}</td>
      <td class="history-when">${timeAgo(r.rolled_at)}</td>
    </tr>
  `).join('');
}

function timeAgo(isoStr) {
  const diffMs = Date.now() - new Date(isoStr + 'Z').getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

loadFilterUsers();
loadHistory();
