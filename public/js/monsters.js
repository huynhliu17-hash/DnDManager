// ── Sidebar toggle ──
function toggleSidebar() {
  document.getElementById('mn-sidebar').classList.toggle('open');
}

// ── Auth ──
fetch('/api/me').then(r => r.json()).then(data => {
  if (!data.username) { window.location.href = '/login.html'; return; }
  document.getElementById('nav-username').textContent = data.username;
  if (data.admin) document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  loadMonsterList();
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// ── State ──
let currentId = null;
let saveTimer = null;
let monsterAttacks = [];

// ── Monster list ──
async function loadMonsterList() {
  const res = await fetch('/api/monsters');
  const monsters = await res.json();
  const list = document.getElementById('monster-list');

  if (!monsters.length) {
    list.innerHTML = '<li class="char-list-empty">No monsters yet.</li>';
    if (currentId === null) showEmpty();
    return;
  }

  if (currentId === null) {
    currentId = monsters[0].id;
    const first = await fetch(`/api/monsters/${monsters[0].id}`).then(r => r.json());
    populateForm(first);
    showForm();
  }

  list.innerHTML = monsters.map(m => `
    <li class="char-list-item${m.id === currentId ? ' active' : ''}" data-id="${m.id}" onclick="loadMonster(${m.id})">
      <span>${escHtml(m.name || 'Unnamed Monster')}</span>
      <span class="char-list-sub">HP ${m.current_hp}/${m.max_hp} &middot; AC ${m.ac}</span>
      <button class="char-delete-btn" onclick="deleteMonster(event,${m.id})" title="Delete">&#x2715;</button>
    </li>
  `).join('');
}

function showEmpty() {
  document.getElementById('mn-empty').classList.remove('hidden');
  document.getElementById('mn-form').classList.add('hidden');
}

function showForm() {
  document.getElementById('mn-empty').classList.add('hidden');
  document.getElementById('mn-form').classList.remove('hidden');
}

// ── Create ──
async function createNewMonster() {
  const res = await fetch('/api/monsters', { method: 'POST' });
  const monster = await res.json();
  currentId = monster.id;
  populateForm(monster);
  showForm();
  await loadMonsterList();
}

// ── Load ──
async function loadMonster(id) {
  currentId = id;
  const res = await fetch(`/api/monsters/${id}`);
  const monster = await res.json();
  populateForm(monster);
  showForm();
  document.querySelectorAll('#monster-list .char-list-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === id);
  });
}

function populateForm(monster) {
  document.getElementById('mn-name').value = monster.name || '';
  document.getElementById('mn-ac').value = monster.ac ?? 10;
  document.getElementById('mn-max-hp').value = monster.max_hp ?? 0;
  document.getElementById('mn-current-hp').value = monster.current_hp ?? 0;
  try { monsterAttacks = JSON.parse(monster.attacks) || []; } catch { monsterAttacks = []; }
  renderAttacks();
  updateHpBar();
}

// ── Delete ──
async function deleteMonster(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this monster?')) return;
  await fetch(`/api/monsters/${id}`, { method: 'DELETE' });
  if (currentId === id) {
    currentId = null;
    monsterAttacks = [];
    showEmpty();
  }
  await loadMonsterList();
}

async function deleteCurrentMonster() {
  if (!currentId) return;
  if (!confirm('Delete this monster?')) return;
  await fetch(`/api/monsters/${currentId}`, { method: 'DELETE' });
  currentId = null;
  monsterAttacks = [];
  showEmpty();
  await loadMonsterList();
}

async function deleteAllMonsters() {
  if (!confirm('Delete ALL monsters? This cannot be undone.')) return;
  await fetch('/api/monsters', { method: 'DELETE' });
  currentId = null;
  monsterAttacks = [];
  showEmpty();
  await loadMonsterList();
}

// ── Save (debounced 1200ms) ──
function scheduleSave() {
  clearTimeout(saveTimer);
  const st = document.getElementById('mn-save-status');
  if (st) st.textContent = 'Unsaved...';
  saveTimer = setTimeout(saveMonster, 1200);
}

async function saveMonster() {
  if (!currentId) return;
  const body = {
    name: document.getElementById('mn-name').value,
    ac: parseInt(document.getElementById('mn-ac').value) || 10,
    max_hp: parseInt(document.getElementById('mn-max-hp').value) || 0,
    current_hp: parseInt(document.getElementById('mn-current-hp').value) || 0,
    attacks: JSON.stringify(monsterAttacks),
  };
  const res = await fetch(`/api/monsters/${currentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const st = document.getElementById('mn-save-status');
    if (st) {
      st.textContent = 'Saved';
      setTimeout(() => { if (st) st.textContent = ''; }, 2000);
    }
    loadMonsterList();
  }
}

// ── HP bar ──
function updateHpBar() {
  const cur = parseInt(document.getElementById('mn-current-hp').value) || 0;
  const max = parseInt(document.getElementById('mn-max-hp').value) || 0;
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const fill = document.getElementById('mn-hp-fill');
  if (!fill) return;
  fill.style.width = pct + '%';
  fill.className = 'mn-hp-fill ' + (pct > 50 ? 'hp-high' : pct > 25 ? 'hp-mid' : 'hp-low');
}

// ── HP damage ──
function applyDamage() {
  if (!currentId) return;
  const dmgInput = document.getElementById('mn-damage-input');
  const dmg = parseInt(dmgInput.value) || 0;
  if (dmg <= 0) return;

  const curEl = document.getElementById('mn-current-hp');
  curEl.value = Math.max(0, (parseInt(curEl.value) || 0) - dmg);
  dmgInput.value = '';
  updateHpBar();
  scheduleSave();
}

// ── Attacks ──
function renderAttacks() {
  const tbody = document.getElementById('mn-attacks-body');
  if (!tbody) return;
  if (!monsterAttacks.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="mn-attacks-empty">No attacks added.</td></tr>';
    return;
  }
  tbody.innerHTML = monsterAttacks.map((a, i) => `
    <tr>
      <td><input type="text" value="${escHtml(a.name || '')}" oninput="monsterAttacks[${i}].name=this.value;scheduleSave()" placeholder="Name"></td>
      <td><input type="text" value="${escHtml(a.bonus || '')}" oninput="monsterAttacks[${i}].bonus=this.value;scheduleSave()" placeholder="+5"></td>
      <td><input type="text" value="${escHtml(a.damage || '')}" oninput="monsterAttacks[${i}].damage=this.value;scheduleSave()" placeholder="2d6+3 slashing"></td>
      <td><button type="button" class="btn-rm" onclick="removeAttack(${i})">&#x2715;</button></td>
    </tr>
  `).join('');
}

function addAttack() {
  monsterAttacks.push({ name: '', bonus: '', damage: '' });
  renderAttacks();
  scheduleSave();
}

function removeAttack(i) {
  monsterAttacks.splice(i, 1);
  renderAttacks();
  scheduleSave();
}

