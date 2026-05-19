fetch('/api/me').then(r => r.json()).then(data => {
  if (!data.username) { window.location.href = '/login.html'; return; }
  if (!data.admin) { window.location.href = '/'; return; }
  document.getElementById('nav-username').textContent = data.username;
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  loadHistory();
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

async function refreshHistory() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  await loadHistory();
  btn.disabled = false;
  btn.innerHTML = '&#x21bb; Refresh';
}

async function loadHistory() {
  const rows = await fetch('/api/loot/history').then(r => r.json());
  renderHistory(rows);
}

function renderHistory(rows) {
  const tbody = document.getElementById('history-tbody');
  const empty = document.getElementById('history-empty');
  tbody.innerHTML = '';
  if (!rows.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="loot-hist-ts">${escHtml(formatHistTs(row.ts))}</td>
      <td>${escHtml(row.username)}</td>
      <td><span class="loot-hist-source loot-hist-source--${escHtml(row.source || 'loot')}">${escHtml(row.source || 'loot')}</span></td>
      <td class="loot-hist-action loot-hist-action--${escHtml(row.action)}">${escHtml(row.action)}</td>
      <td>${escHtml(row.item_name || '—')}</td>
      <td class="loot-hist-detail">${escHtml(formatHistDetail(row))}</td>
    `;
    tbody.appendChild(tr);
  });
}

function formatHistTs(ts) {
  return new Date(ts.replace(' ', 'T') + 'Z').toLocaleString();
}

function formatHistDetail(row) {
  const src = row.source || 'loot';
  switch (row.action) {
    case 'create': return src === 'sheet' ? 'Created character sheet' : 'Created item';
    case 'delete': return src === 'sheet' ? 'Deleted character sheet' : 'Deleted item';
    case 'update': return `${row.field}: "${row.old_val}" → "${row.new_val}"`;
    case 'money':  return `Party ${row.field}: ${row.old_val} → ${row.new_val}`;
    default:       return '';
  }
}
