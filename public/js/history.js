// ── Function Index ──────────────────────────────────────────────────────────
// Auth       logout
// Filters    applyFilters  clearFilters  populateUserFilter  activeFilters
// History    refreshHistory  loadHistory  renderHistory  renderPagination
//            formatHistTs  formatHistDetail
// ────────────────────────────────────────────────────────────────────────────

let currentPage = 1;
let filterUser   = '';
let filterAction = '';

fetch('/api/me').then(r => r.json()).then(data => {
  if (!data.username) { window.location.href = '/login.html'; return; }
  if (!data.admin)    { window.location.href = '/'; return; }
  document.getElementById('nav-username').textContent = data.username;
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  loadHistory(1);
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// ── Filters ──────────────────────────────────────────────────────────────────

function applyFilters() {
  filterUser   = document.getElementById('filter-user').value;
  filterAction = document.getElementById('filter-action').value;
  document.getElementById('btn-clear-filters').style.display =
    (filterUser || filterAction) ? '' : 'none';
  loadHistory(1);
}

function clearFilters() {
  document.getElementById('filter-user').value   = '';
  document.getElementById('filter-action').value = '';
  filterUser   = '';
  filterAction = '';
  document.getElementById('btn-clear-filters').style.display = 'none';
  loadHistory(1);
}

function populateUserFilter(users) {
  const sel = document.getElementById('filter-user');
  const prev = sel.value;
  sel.innerHTML = '<option value="">All users</option>';
  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u;
    opt.textContent = u;
    if (u === prev) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── History ───────────────────────────────────────────────────────────────────

async function refreshHistory() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  await loadHistory(currentPage);
  btn.disabled = false;
  btn.innerHTML = '&#x21bb; Refresh';
}

async function loadHistory(page) {
  currentPage = page;
  const params = new URLSearchParams({ page });
  if (filterUser)   params.set('user',   filterUser);
  if (filterAction) params.set('action', filterAction);
  const data = await fetch(`/api/loot/history?${params}`).then(r => r.json());
  populateUserFilter(data.users || []);
  renderHistory(data.rows);
  renderPagination(data.page, data.pages, data.total);
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

function renderPagination(page, pages, total) {
  const el = document.getElementById('history-pagination');
  el.innerHTML = '';
  if (pages <= 1 && total === 0) return;

  // Prev button
  const prev = document.createElement('button');
  prev.className = 'btn-secondary pagination-btn';
  prev.textContent = '← Prev';
  prev.disabled = page <= 1;
  prev.onclick = () => loadHistory(page - 1);

  // Info
  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.textContent = `Page ${page} of ${pages} (${total} entries)`;

  // Next button
  const next = document.createElement('button');
  next.className = 'btn-secondary pagination-btn';
  next.textContent = 'Next →';
  next.disabled = page >= pages;
  next.onclick = () => loadHistory(page + 1);

  el.append(prev, info, next);

  // Page-jump (only useful when there's more than one page)
  if (pages > 1) {
    const sep = document.createElement('span');
    sep.className = 'pagination-info';
    sep.textContent = '|';
    sep.style.opacity = '0.35';

    const jumpLabel = document.createElement('span');
    jumpLabel.className = 'pagination-info';
    jumpLabel.textContent = 'Go to:';

    const jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = 1;
    jumpInput.max = pages;
    jumpInput.value = page;
    jumpInput.className = 'pagination-jump-input';
    jumpInput.title = `Page 1 – ${pages}`;
    jumpInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') doJump(jumpInput, pages);
    });

    const jumpBtn = document.createElement('button');
    jumpBtn.className = 'btn-secondary pagination-btn';
    jumpBtn.textContent = 'Go';
    jumpBtn.style.minWidth = '44px';
    jumpBtn.onclick = () => doJump(jumpInput, pages);

    el.append(sep, jumpLabel, jumpInput, jumpBtn);
  }
}

function doJump(input, pages) {
  const target = Math.max(1, Math.min(pages, parseInt(input.value) || 1));
  input.value = target;
  loadHistory(target);
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
