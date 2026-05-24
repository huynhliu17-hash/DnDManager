// ── Function Index ──────────────────────────────────────────────────────────
// Auth     logout
// Money    loadMoney  scheduleMoneySave  adjustMoney  saveMoney  applyMoneyTransaction
//          showMoneyError  clearMoneyError
// Items    refreshLoot  loadItems  createItem  removeItem  fieldChange
//          scheduleItemSave  saveItem
// Filter   onSearchInput  onTagFilter  toggleSort  updateSortHeaders  renderItems
// Notes    openNotesPopup  closeNotesPopup  onNotesOverlayClick
// ────────────────────────────────────────────────────────────────────────────

// State
let items = [];
let notesOpenId = null;
let moneyTimer = null;
const itemTimers = {};
let searchQuery = '';
let filterTag = '';
let sortCol = null;
let sortDir = null;

const TAGS = ['', 'Weapon', 'Armour', 'Potion', 'Scroll', 'Magic', 'Non-magic', 'Gem', 'Art', 'Currency', 'Misc'];

// ── Init ──

fetch('/api/me').then(r => r.json()).then(data => {
  if (!data.username) { window.location.href = '/login.html'; return; }
  document.getElementById('nav-username').textContent = data.username;
  if (data.admin) document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  const tagFilter = document.getElementById('loot-tag-filter');
  TAGS.filter(t => t).forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    tagFilter.appendChild(opt);
  });
  await Promise.all([loadMoney(), loadItems()]);
});

// ── Money ──

async function loadMoney() {
  const data = await fetch('/api/loot/money').then(r => r.json());
  document.getElementById('money-pp').value = data.pp || 0;
  document.getElementById('money-gp').value = data.gp || 0;
  document.getElementById('money-ep').value = data.ep || 0;
  document.getElementById('money-sp').value = data.sp || 0;
  document.getElementById('money-cp').value = data.cp || 0;
}

function scheduleMoneySave() {
  clearTimeout(moneyTimer);
  moneyTimer = setTimeout(saveMoney, 800);
}

function adjustMoney(coin, delta) {
  const el = document.getElementById('money-' + coin);
  el.value = Math.max(0, (parseInt(el.value) || 0) + delta);
  scheduleMoneySave();
}

function saveMoney() {
  fetch('/api/loot/money', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pp: parseInt(document.getElementById('money-pp').value) || 0,
      gp: parseInt(document.getElementById('money-gp').value) || 0,
      ep: parseInt(document.getElementById('money-ep').value) || 0,
      sp: parseInt(document.getElementById('money-sp').value) || 0,
      cp: parseInt(document.getElementById('money-cp').value) || 0,
    })
  });
}

// ── Money Transaction ──

const COIN_TO_CP = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const COIN_ORDER = ['cp', 'sp', 'ep', 'gp', 'pp'];

function applyMoneyTransaction() {
  const mode = document.getElementById('txn-mode').value;
  const amount = parseInt(document.getElementById('txn-amount').value) || 0;
  const currency = document.getElementById('txn-currency').value;

  clearMoneyError();
  if (amount <= 0) return;

  const current = {
    pp: parseInt(document.getElementById('money-pp').value) || 0,
    gp: parseInt(document.getElementById('money-gp').value) || 0,
    ep: parseInt(document.getElementById('money-ep').value) || 0,
    sp: parseInt(document.getElementById('money-sp').value) || 0,
    cp: parseInt(document.getElementById('money-cp').value) || 0,
  };

  if (mode === 'add') {
    current[currency] += amount;
  } else {
    const costCP = amount * COIN_TO_CP[currency];
    const totalCP = COIN_ORDER.reduce((sum, c) => sum + current[c] * COIN_TO_CP[c], 0);

    if (costCP > totalCP) {
      showMoneyError('Insufficient funds — the party cannot cover this cost.');
      return;
    }

    // Deduct from selected type first
    let remainCP = costCP;
    const fromSelected = Math.min(current[currency], Math.floor(remainCP / COIN_TO_CP[currency]));
    current[currency] -= fromSelected;
    remainCP -= fromSelected * COIN_TO_CP[currency];

    // Deduct remainder smallest → largest, skipping selected type
    for (const coin of COIN_ORDER) {
      if (coin === currency || remainCP <= 0) continue;
      const take = Math.min(current[coin], Math.ceil(remainCP / COIN_TO_CP[coin]));
      current[coin] -= take;
      remainCP -= take * COIN_TO_CP[coin];
    }

    // If we over-deducted (e.g. broke a coin), return change in proper denominations
    if (remainCP < 0) {
      let change = Math.abs(remainCP);
      for (let i = COIN_ORDER.length - 1; i >= 0; i--) {
        const coin = COIN_ORDER[i];
        const val = COIN_TO_CP[coin];
        const count = Math.floor(change / val);
        if (count > 0) { current[coin] += count; change -= count * val; }
      }
      if (change > 0) current.cp += change;
    }
  }

  document.getElementById('money-pp').value = current.pp;
  document.getElementById('money-gp').value = current.gp;
  document.getElementById('money-ep').value = current.ep;
  document.getElementById('money-sp').value = current.sp;
  document.getElementById('money-cp').value = current.cp;
  saveMoney();
  document.getElementById('txn-amount').value = '';
}

function showMoneyError(msg) {
  const el = document.getElementById('txn-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearMoneyError() {
  document.getElementById('txn-error').classList.add('hidden');
}

// ── Items ──

async function refreshLoot() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  await Promise.all([loadMoney(), loadItems()]);
  btn.disabled = false;
  btn.innerHTML = '&#x21bb; Refresh';
}

async function loadItems() {
  items = await fetch('/api/loot').then(r => r.json());
  renderItems();
}

function onSearchInput(val) {
  searchQuery = val;
  renderItems();
}

function onTagFilter(val) {
  filterTag = val;
  renderItems();
}

function toggleSort(col) {
  if (sortCol !== col) {
    sortCol = col;
    sortDir = 'desc';
  } else if (sortDir === 'desc') {
    sortDir = 'asc';
  } else {
    sortCol = null;
    sortDir = null;
  }
  renderItems();
}

function updateSortHeaders() {
  document.querySelectorAll('.sort-icon').forEach(el => {
    el.textContent = el.dataset.col === sortCol
      ? (sortDir === 'desc' ? ' ▼' : ' ▲')
      : '';
  });
}

function renderItems() {
  const tbody = document.getElementById('loot-tbody');
  const empty = document.getElementById('loot-empty');
  tbody.innerHTML = '';

  updateSortHeaders();

  let visible = items.filter(item => {
    const matchSearch = !searchQuery || (item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchTag = !filterTag || item.tag === filterTag;
    return matchSearch && matchTag;
  });

  if (sortCol) {
    visible = visible.slice().sort((a, b) => {
      let av = a[sortCol] ?? '';
      let bv = b[sortCol] ?? '';
      if (sortCol === 'quantity') {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      } else {
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  if (visible.length === 0) {
    empty.textContent = items.length === 0
      ? 'No items yet. Click “+ Create Item” to add one.'
      : 'No items match your search or filter.';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  visible.forEach(item => {
    const tr = document.createElement('tr');
    const tagOptions = TAGS.map(t =>
      `<option value="${escHtml(t)}" ${item.tag === t ? 'selected' : ''}>${escHtml(t) || '—'}</option>`
    ).join('');

    tr.innerHTML = `
      <td><input type="text" value="${escHtml(item.name || '')}" placeholder="Item name"
        oninput="fieldChange(${item.id},'name',this.value)"></td>
      <td><select onchange="fieldChange(${item.id},'tag',this.value)">${tagOptions}</select></td>
      <td><input type="text" value="${escHtml(item.location || '')}" placeholder="Where found"
        oninput="fieldChange(${item.id},'location',this.value)"></td>
      <td><input type="text" value="${escHtml(item.value || '')}" placeholder="e.g. 50 gp"
        oninput="fieldChange(${item.id},'value',this.value)" class="loot-value-input"></td>
      <td><input type="number" value="${item.quantity ?? 1}" min="1"
        oninput="fieldChange(${item.id},'quantity',this.value)" class="loot-qty-input"></td>
      <td class="loot-actions-cell">
        <button type="button" class="btn-spell-info" onclick="openNotesPopup(${item.id})" title="Notes">ℹ</button>
        <button type="button" class="btn-rm" onclick="removeItem(${item.id})" title="Delete">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function createItem() {
  const item = await fetch('/api/loot', { method: 'POST' }).then(r => r.json());
  items.push(item);
  renderItems();
  // Focus the name input of the new row
  const rows = document.getElementById('loot-tbody').querySelectorAll('tr');
  const last = rows[rows.length - 1];
  if (last) last.querySelector('input')?.focus();
}

async function removeItem(id) {
  await fetch(`/api/loot/${id}`, { method: 'DELETE' });
  items = items.filter(i => i.id !== id);
  clearTimeout(itemTimers[id]);
  delete itemTimers[id];
  renderItems();
}

function fieldChange(id, field, value) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item[field] = field === 'quantity' ? (parseInt(value) || 1) : value;
  scheduleItemSave(id);
}

function scheduleItemSave(id) {
  clearTimeout(itemTimers[id]);
  itemTimers[id] = setTimeout(() => saveItem(id), 800);
}

function saveItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  fetch(`/api/loot/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: item.name,
      tag: item.tag,
      location: item.location,
      value: item.value,
      quantity: item.quantity,
      notes: item.notes,
    })
  });
}

// ── Notes Popup ──

function openNotesPopup(id) {
  notesOpenId = id;
  const item = items.find(i => i.id === id);
  document.getElementById('loot-notes-title').textContent = item?.name || '(Unnamed Item)';
  const body = document.getElementById('loot-notes-body');
  body.innerHTML = `<textarea class="spell-desc-textarea" id="loot-notes-edit" placeholder="Enter notes…">${escHtml(item?.notes || '')}</textarea>`;
  document.getElementById('loot-notes-edit').addEventListener('input', function () {
    const it = items.find(i => i.id === notesOpenId);
    if (!it) return;
    it.notes = this.value;
    scheduleItemSave(notesOpenId);
  });
  document.getElementById('loot-notes-overlay').classList.remove('hidden');
}

function closeNotesPopup() {
  document.getElementById('loot-notes-overlay').classList.add('hidden');
  notesOpenId = null;
}

function onNotesOverlayClick(e) {
  if (e.target === document.getElementById('loot-notes-overlay')) closeNotesPopup();
}

