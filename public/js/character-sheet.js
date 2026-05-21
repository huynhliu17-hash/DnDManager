// ── Function Index ────────────────────────────────────────────────────────
// UI       toggleSidebar  closeSidebar  toggleLore
// Calc     mod  fmtMod  getAbilityScores  recalc  applyDamage
// State    loadCharList  createNewCharacter  loadCharacter  updateCharList
//          setStatus  scheduleSave  saveCharacter  deleteCharacter
// Render   bindDragRow  renderAttacks  addAttack  removeAttack
//          renderSpells  addSpell  removeSpell  renderSpellSlots  toggleSpellSlot
// Popup    openSpellPopup  closeSpellPopup  onSpellDescOverlayClick
// Search   openSearchModal  closeSearchModal  onSearchOverlayClick  addCustomEntry
//          onDndSearchInput  runDndSearch  gqlSearchSpells  gqlSearchWeapons
//          renderDndResults  selectDndItem  weaponAbilityMod  weaponBonus  weaponDamage
// Party    setReadOnly  loadPlayers  onPlayerSelect  loadPartyCharacter
// Steppers stepNum  initNumSteppers
// ─────────────────────────────────────────────────────────────────────────

// ── Sidebar toggle ──
function toggleSidebar() {
  document.getElementById('cs-sidebar').classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('cs-sidebar').classList.remove('open');
}

// ── Lore tab toggle ──
function toggleLore(bodyId, arrowId) {
  const body = document.getElementById(bodyId);
  const arrow = document.getElementById(arrowId);
  const isHidden = body.classList.toggle('hidden');
  arrow.textContent = isHidden ? '▶' : '▼';
}

// ── Auth ──
let currentUser = null;
fetch('/api/me').then(r => r.json()).then(data => {
  if (!data.username) { window.location.href = '/login.html'; return; }
  currentUser = data;
  document.getElementById('nav-username').textContent = data.username;
  if (data.admin) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }
  loadCharList();
});

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// ── Skill / Save mapping ──
const SKILL_MAP = {
  acrobatics: 'dexterity', animal_handling: 'wisdom', arcana: 'intelligence',
  athletics: 'strength', deception: 'charisma', history: 'intelligence',
  insight: 'wisdom', intimidation: 'charisma', investigation: 'intelligence',
  medicine: 'wisdom', nature: 'intelligence', perception: 'wisdom',
  performance: 'charisma', persuasion: 'charisma', religion: 'intelligence',
  sleight_of_hand: 'dexterity', stealth: 'dexterity', survival: 'wisdom'
};
const SAVE_MAP = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };

function mod(score) { return Math.floor((score - 10) / 2); }
function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }

function getAbilityScores() {
  return {
    strength: parseInt(document.getElementById('strength').value) || 10,
    dexterity: parseInt(document.getElementById('dexterity').value) || 10,
    constitution: parseInt(document.getElementById('constitution').value) || 10,
    intelligence: parseInt(document.getElementById('intelligence').value) || 10,
    wisdom: parseInt(document.getElementById('wisdom').value) || 10,
    charisma: parseInt(document.getElementById('charisma').value) || 10,
  };
}

function recalc() {
  const scores = getAbilityScores();
  const prof = parseInt(document.getElementById('proficiency_bonus').value) || 2;

  // Ability modifiers
  for (const [stat, score] of Object.entries(scores)) {
    const el = document.getElementById('mod-' + stat);
    if (el) el.textContent = fmtMod(mod(score));
  }

  // Saving throws
  for (const [abbr, stat] of Object.entries(SAVE_MAP)) {
    const proficient = document.getElementById('save_' + abbr).checked;
    const val = mod(scores[stat]) + (proficient ? prof : 0);
    document.getElementById('sv-' + abbr).textContent = fmtMod(val);
  }

  // Skills
  for (const [skill, stat] of Object.entries(SKILL_MAP)) {
    const proficient = document.getElementById('skill_' + skill).checked;
    const val = mod(scores[stat]) + (proficient ? prof : 0);
    document.getElementById('sk-' + skill).textContent = fmtMod(val);
  }

  // Passive perception
  const percProf = document.getElementById('skill_perception').checked;
  const percVal = 10 + mod(scores.wisdom) + (percProf ? prof : 0);
  document.getElementById('passive-perc').textContent = percVal;
}

// ── State ──
let currentId = null;
let saveTimer = null;
let attacks = [];
let spells = [];
let spellSlots = Array.from({length: 9}, () => ({pips: Array(4).fill(false)}));
let isReadOnly = false;
let searchContext = null;
let searchDebounce = null;
let _weaponListCache = null;
const _weaponDetailCache = {};

// ── Character list ──
async function loadCharList() {
  const res = await fetch('/api/characters');
  const chars = await res.json();
  const list = document.getElementById('char-list');
  list.innerHTML = '';
  for (const c of chars) {
    const li = document.createElement('li');
    li.className = 'char-list-item' + (c.id === currentId ? ' active' : '');
    li.dataset.charId = c.id;
    li.textContent = c.character_name || '(Unnamed)';
    const sub = document.createElement('span');
    sub.className = 'char-list-sub';
    sub.textContent = [c.class_level, c.race].filter(Boolean).join(' · ');
    li.appendChild(sub);
    li.onclick = () => loadCharacter(c.id);
    const delBtn = document.createElement('button');
    delBtn.className = 'char-delete-btn';
    delBtn.title = 'Delete character';
    delBtn.textContent = '✕';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteCharacter(c.id); };
    li.appendChild(delBtn);
    list.appendChild(li);
  }
  if (chars.length === 0) {
    const li = document.createElement('li');
    li.className = 'char-list-empty';
    li.textContent = 'No characters yet.';
    list.appendChild(li);
  }
  if (currentId === null && !isReadOnly) {
    if (chars.length > 0) {
      await loadCharacter(chars[0].id);
    } else {
      document.getElementById('cs-empty').classList.remove('hidden');
      document.getElementById('cs-form').classList.add('hidden');
    }
  }
}

// ── New Character ──
async function createNewCharacter() {
  const res = await fetch('/api/characters', { method: 'POST' });
  const newSheet = await res.json();
  await loadCharList();
  await loadCharacter(newSheet.id);
}

async function loadCharacter(id) {
  const res = await fetch('/api/characters/' + id);
  if (!res.ok) return;
  const sheet = await res.json();
  currentId = id;
  closeSidebar();

  document.getElementById('cs-empty').classList.add('hidden');
  document.getElementById('cs-form').classList.remove('hidden');

  // Populate text/number fields
  const textFields = [
    'character_name','class_level','background','player_name','race','alignment',
    'experience_points','inspiration','proficiency_bonus',
    'strength','dexterity','constitution','intelligence','wisdom','charisma',
    'armor_class','initiative','speed','max_hp','current_hp','temp_hp','hit_dice',
    'cp','sp','ep','gp','pp','equipment',
    'personality_traits','ideals','bonds','flaws','features_traits',
    'backstory','allies_organizations','additional_features','treasure'
  ];
  for (const f of textFields) {
    const el = document.getElementById(f);
    if (el) el.value = sheet[f] ?? '';
  }

  // Checkboxes
  const checkFields = [
    'save_str','save_dex','save_con','save_int','save_wis','save_cha',
    'skill_acrobatics','skill_animal_handling','skill_arcana','skill_athletics',
    'skill_deception','skill_history','skill_insight','skill_intimidation',
    'skill_investigation','skill_medicine','skill_nature','skill_perception',
    'skill_performance','skill_persuasion','skill_religion','skill_sleight_of_hand',
    'skill_stealth','skill_survival'
  ];
  for (const f of checkFields) {
    const el = document.getElementById(f);
    if (el) el.checked = sheet[f] === 1;
  }

  // Death saves
  const success = sheet.death_save_success || 0;
  const fail = sheet.death_save_fail || 0;
  document.querySelectorAll('[data-death="success"]').forEach((cb, i) => cb.checked = i < success);
  document.querySelectorAll('[data-death="fail"]').forEach((cb, i) => cb.checked = i < fail);

  // Attacks & Spells
  try { attacks = JSON.parse(sheet.attacks || '[]'); } catch { attacks = []; }
  renderAttacks();
  try { spells = JSON.parse(sheet.spells || '[]'); } catch { spells = []; }
  renderSpells();
  try { spellSlots = JSON.parse(sheet.spell_slots || '[]'); } catch { spellSlots = []; }
  while (spellSlots.length < 9) spellSlots.push({pips: Array(4).fill(false)});
  spellSlots = spellSlots.map(s => s.pips ? s : {pips: Array(4).fill(false).map((_, i) => i < (s.used || 0))});

  recalc();
  updateCharList();
  document.querySelectorAll('#party-char-list .char-list-item').forEach(li => li.classList.remove('active'));
  setReadOnly(false);
  setStatus('');
}

function updateCharList() {
  document.querySelectorAll('.char-list-item').forEach((li, i) => {
    li.classList.toggle('active', li.dataset.charId === String(currentId));
  });
}

// ── HP damage ──
function applyDamage() {
  if (isReadOnly) return;
  const dmgInput = document.getElementById('damage-input');
  const dmg = parseInt(dmgInput.value) || 0;
  if (dmg <= 0) return;

  const tempEl = document.getElementById('temp_hp');
  const curEl  = document.getElementById('current_hp');
  let temp = parseInt(tempEl.value) || 0;
  let cur  = parseInt(curEl.value)  || 0;

  const tempAbsorb = Math.min(dmg, temp);
  temp -= tempAbsorb;
  cur   = Math.max(0, cur - (dmg - tempAbsorb));

  tempEl.value = temp;
  curEl.value  = cur;
  dmgInput.value = '';
  recalc();
  scheduleSave();
}

// ── Form input handling ──
function setStatus(msg) {
  document.getElementById('save-status').textContent = msg;
}

function scheduleSave() {
  if (isReadOnly) return;
  setStatus('Unsaved changes...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCharacter, 1200);
}

async function saveCharacter() {
  if (!currentId) return;
  const scores = getAbilityScores();
  const prof = parseInt(document.getElementById('proficiency_bonus').value) || 2;

  const body = {};
  // Text / number fields
  const fields = [
    'character_name','class_level','background','player_name','race','alignment',
    'experience_points','inspiration','proficiency_bonus',
    'strength','dexterity','constitution','intelligence','wisdom','charisma',
    'armor_class','initiative','speed','max_hp','current_hp','temp_hp','hit_dice',
    'cp','sp','ep','gp','pp','equipment',
    'personality_traits','ideals','bonds','flaws','features_traits',
    'backstory','allies_organizations','additional_features','treasure'
  ];
  for (const f of fields) {
    const el = document.getElementById(f);
    if (el) body[f] = el.type === 'number' ? (parseInt(el.value) || 0) : el.value;
  }

  // Checkboxes
  const checkFields = [
    'save_str','save_dex','save_con','save_int','save_wis','save_cha',
    'skill_acrobatics','skill_animal_handling','skill_arcana','skill_athletics',
    'skill_deception','skill_history','skill_insight','skill_intimidation',
    'skill_investigation','skill_medicine','skill_nature','skill_perception',
    'skill_performance','skill_persuasion','skill_religion','skill_sleight_of_hand',
    'skill_stealth','skill_survival'
  ];
  for (const f of checkFields) {
    const el = document.getElementById(f);
    if (el) body[f] = el.checked ? 1 : 0;
  }

  // Death saves — count checked boxes
  const succPips = [...document.querySelectorAll('[data-death="success"]')];
  const failPips = [...document.querySelectorAll('[data-death="fail"]')];
  body.death_save_success = succPips.filter(c => c.checked).length;
  body.death_save_fail = failPips.filter(c => c.checked).length;

  body.attacks = JSON.stringify(attacks);
  body.spells = JSON.stringify(spells);
  body.spell_slots = JSON.stringify(spellSlots);

  const res = await fetch('/api/characters/' + currentId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    setStatus('Saved.');
    loadCharList();
  } else {
    setStatus('Save failed!');
  }
}

// ── Drag-to-reorder ──
let _dragSrcIdx = null;

function bindDragRow(tr) {
  tr.addEventListener('dragstart', function(e) {
    _dragSrcIdx = parseInt(this.dataset.idx);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  tr.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tbody = this.closest('tbody');
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
    if (parseInt(this.dataset.idx) !== _dragSrcIdx) this.classList.add('drag-over');
  });
  tr.addEventListener('dragleave', function() {
    this.classList.remove('drag-over');
  });
  tr.addEventListener('drop', function(e) {
    e.preventDefault();
    const destIdx = parseInt(this.dataset.idx);
    if (_dragSrcIdx === null || _dragSrcIdx === destIdx) return;
    const arr = this.dataset.dragType === 'attack' ? attacks : spells;
    const [item] = arr.splice(_dragSrcIdx, 1);
    arr.splice(destIdx, 0, item);
    if (this.dataset.dragType === 'attack') renderAttacks(); else renderSpells();
    scheduleSave();
  });
  tr.addEventListener('dragend', function() {
    document.querySelectorAll('#attacks-body tr, #spells-body tr').forEach(r => {
      r.classList.remove('dragging', 'drag-over');
    });
    _dragSrcIdx = null;
  });
}

// ── Attacks ──
function renderAttacks() {
  const tbody = document.getElementById('attacks-body');
  tbody.innerHTML = '';
  attacks.forEach((atk, i) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    tr.dataset.dragType = 'attack';
    if (!isReadOnly) tr.draggable = true;
    tr.innerHTML = `
      <td class="drag-handle" title="Drag to reorder">⠿</td>
      <td><input type="text" value="${escHtml(atk.name || '')}" oninput="attacks[${i}].name=this.value;scheduleSave()" placeholder="Name"></td>
      <td><input type="text" value="${escHtml(atk.bonus || '')}" oninput="attacks[${i}].bonus=this.value;scheduleSave()" placeholder="+5"></td>
      <td><input type="text" value="${escHtml(atk.damage || '')}" oninput="attacks[${i}].damage=this.value;scheduleSave()" placeholder="1d8+3 piercing"></td>
      <td><button type="button" class="btn-rm" onclick="removeAttack(${i})">✕</button></td>
    `;
    if (!isReadOnly) bindDragRow(tr);
    tbody.appendChild(tr);
  });
}

function addAttack() {
  openSearchModal('attack');
}

function removeAttack(i) {
  attacks.splice(i, 1);
  renderAttacks();
  scheduleSave();
}

function renderSpells() {
  const tbody = document.getElementById('spells-body');
  tbody.innerHTML = '';
  spells.forEach((sp, i) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    tr.dataset.dragType = 'spell';
    if (!isReadOnly) tr.draggable = true;
    tr.innerHTML = `
      <td class="drag-handle" title="Drag to reorder">⠿</td>
      <td><input type="text" value="${escHtml(sp.name || '')}" oninput="spells[${i}].name=this.value;scheduleSave()" placeholder="Fireball"></td>
      <td><input type="text" value="${escHtml(sp.level || '')}" oninput="spells[${i}].level=this.value;scheduleSave()" placeholder="3rd"></td>
      <td><input type="text" value="${escHtml(sp.notes || '')}" oninput="spells[${i}].notes=this.value;scheduleSave()" placeholder="8d6 fire, DEX save"></td>
      <td><button type="button" class="btn-spell-info" onclick="openSpellPopup(${i})" title="Description">ℹ</button><button type="button" class="btn-rm" onclick="removeSpell(${i})">✕</button></td>
    `;
    if (!isReadOnly) bindDragRow(tr);
    tbody.appendChild(tr);
  });
}

function addSpell() {
  openSearchModal('spell');
}

function removeSpell(i) {
  spells.splice(i, 1);
  renderSpells();
  scheduleSave();
}

// ── Spell Slots ──
function renderSpellSlots() {
  const MAX_PIPS = 4;
  const grid = document.getElementById('spell-slots-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let level = 1; level <= 9; level++) {
    const slot = spellSlots[level - 1];
    const pipState = slot.pips || Array(MAX_PIPS).fill(false);

    const row = document.createElement('div');
    row.className = 'spell-slot-row';

    const label = document.createElement('span');
    label.className = 'spell-slot-label';
    label.textContent = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'][level - 1];
    row.appendChild(label);

    const pipsDiv = document.createElement('div');
    pipsDiv.className = 'spell-slot-pips';
    for (let p = 0; p < MAX_PIPS; p++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'spell-slot-pip' + (pipState[p] ? ' pip-filled' : '');
      btn.title = pipState[p] ? 'Expended — click to recover' : 'Available — click to expend';
      if (!isReadOnly) {
        const li = level - 1, pi = p;
        btn.addEventListener('click', () => toggleSpellSlot(li, pi));
      }
      pipsDiv.appendChild(btn);
    }
    row.appendChild(pipsDiv);
    grid.appendChild(row);
  }
}

function toggleSpellSlot(levelIdx, pipIdx) {
  if (isReadOnly) return;
  const slot = spellSlots[levelIdx];
  if (!slot.pips) slot.pips = Array(4).fill(false);
  const filled = slot.pips.filter(Boolean).length;
  const newFilled = (pipIdx + 1 === filled) ? pipIdx : pipIdx + 1;
  slot.pips = Array(4).fill(false).map((_, i) => i < newFilled);
  renderSpellSlots();
  scheduleSave();
}

// ── Spell Description Popup ──
let spellPopupIdx = null;

function openSpellPopup(i) {
  spellPopupIdx = i;
  const sp = spells[i];
  document.getElementById('spell-desc-title').textContent = sp.name || '(Unnamed Spell)';
  const body = document.getElementById('spell-desc-body');
  const editable = !isReadOnly && sp.custom !== false;
  if (editable) {
    body.innerHTML = `<textarea class="spell-desc-textarea" id="spell-desc-edit" placeholder="Enter description…">${escHtml(sp.description || '')}</textarea>`;
    document.getElementById('spell-desc-edit').addEventListener('input', function() {
      spells[spellPopupIdx].description = this.value;
      scheduleSave();
    });
  } else {
    const desc = sp.description || '';
    body.innerHTML = desc
      ? `<div class="spell-desc-text">${escHtml(desc)}</div>`
      : '<p class="spell-desc-empty">No description available.</p>';
  }
  document.getElementById('spell-desc-overlay').classList.remove('hidden');
}

function closeSpellPopup() {
  document.getElementById('spell-desc-overlay').classList.add('hidden');
  spellPopupIdx = null;
}

function onSpellDescOverlayClick(e) {
  if (e.target === document.getElementById('spell-desc-overlay')) closeSpellPopup();
}

// ── DnD Search Modal ──
function openSearchModal(context) {
  searchContext = context;
  document.getElementById('dnd-search-title').textContent =
    context === 'attack' ? 'Search Weapons' : 'Search Spells';
  const input = document.getElementById('dnd-search-input');
  input.value = '';
  input.placeholder = context === 'attack' ? 'Search weapons (e.g. longsword)…' : 'Search spells (e.g. fireball)…';
  document.getElementById('dnd-search-results').innerHTML =
    '<p class="dnd-search-hint">Type to search the D&D 5e database…</p>';
  document.getElementById('dnd-search-overlay').classList.remove('hidden');
  setTimeout(() => input.focus(), 50);
}

function closeSearchModal() {
  document.getElementById('dnd-search-overlay').classList.add('hidden');
  clearTimeout(searchDebounce);
  searchContext = null;
}

function onSearchOverlayClick(e) {
  if (e.target === document.getElementById('dnd-search-overlay')) closeSearchModal();
}

function addCustomEntry() {
  const ctx = searchContext;
  closeSearchModal();
  if (ctx === 'attack') {
    attacks.push({ name: '', bonus: '', damage: '' });
    renderAttacks();
  } else {
    spells.push({ name: '', level: '', notes: '', description: '', custom: true });
    renderSpells();
  }
  scheduleSave();
}

function onDndSearchInput() {
  clearTimeout(searchDebounce);
  const val = document.getElementById('dnd-search-input').value.trim();
  if (val.length < 2) {
    document.getElementById('dnd-search-results').innerHTML =
      '<p class="dnd-search-hint">Type at least 2 characters…</p>';
    return;
  }
  document.getElementById('dnd-search-results').innerHTML =
    '<p class="dnd-search-hint">Searching…</p>';
  searchDebounce = setTimeout(() => runDndSearch(val), 400);
}

async function runDndSearch(term) {
  const ctx = searchContext;
  const el = document.getElementById('dnd-search-results');
  try {
    const items = ctx === 'attack' ? await gqlSearchWeapons(term) : await gqlSearchSpells(term);
    renderDndResults(items, ctx, el);
  } catch {
    el.innerHTML = '<p class="dnd-search-hint">Failed to fetch results — check your connection.</p>';
  }
}

async function gqlSearchSpells(name) {
  const safeName = name.replace(/["\\]/g, '');
  const query = `{ spells(name: "${safeName}", limit: 20) { index name level school { name } attack_type range damage { damage_type { name } } desc } }`;
  const res = await fetch('https://www.dnd5eapi.co/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const json = await res.json();
  return json.data?.spells ?? [];
}

async function gqlSearchWeapons(name) {
  if (!_weaponListCache) {
    const res = await fetch('https://www.dnd5eapi.co/api/equipment-categories/weapon');
    const data = await res.json();
    _weaponListCache = data.equipment || [];
  }
  const lower = name.toLowerCase();
  const matches = _weaponListCache.filter(w => w.name.toLowerCase().includes(lower)).slice(0, 10);
  if (!matches.length) return [];
  return Promise.all(matches.map(async m => {
    if (_weaponDetailCache[m.index]) return _weaponDetailCache[m.index];
    const d = await fetch('https://www.dnd5eapi.co' + m.url).then(r => r.json());
    const norm = {
      index: d.index, name: d.name,
      weapon_range: d.weapon_range || '',
      weapon_category: d.weapon_category || '',
      damage: d.damage || null,
      properties: d.properties || []
    };
    _weaponDetailCache[m.index] = norm;
    return norm;
  }));
}

function renderDndResults(items, ctx, container) {
  if (!items.length) {
    container.innerHTML = '<p class="dnd-search-hint">No results found.</p>';
    return;
  }
  container.innerHTML = '';
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'dnd-result-item';
    let subParts;
    if (ctx === 'attack') {
      const dmg = item.damage ? `${item.damage.damage_dice} ${item.damage.damage_type?.name ?? ''}`.trim() : '';
      subParts = [item.weapon_category, item.weapon_range, dmg].filter(Boolean);
    } else {
      const lvlText = item.level === 0 ? 'Cantrip' : `Level ${item.level}`;
      subParts = [lvlText, item.school?.name].filter(Boolean);
    }
    div.innerHTML = `
      <div class="dnd-result-name">${escHtml(item.name)}</div>
      <div class="dnd-result-sub">${subParts.map(escHtml).join(' &bull; ')}</div>
    `;
    div.addEventListener('click', () => selectDndItem(item, ctx));
    container.appendChild(div);
  }
}

function selectDndItem(item, ctx) {
  if (ctx === 'spell') {
    const level = item.level === 0 ? 'Cantrip' : String(item.level);
    const noteParts = [item.school?.name, item.attack_type, item.damage?.damage_type?.name, item.range].filter(Boolean);
    const desc = Array.isArray(item.desc) ? item.desc.join('\n\n') : (item.desc || '');
    spells.push({ name: item.name, level, notes: noteParts.join(', '), description: desc, custom: false });
    renderSpells();
  } else {
    attacks.push({ name: item.name, bonus: weaponBonus(item), damage: weaponDamage(item) });
    renderAttacks();
  }
  scheduleSave();
  closeSearchModal();
}

function weaponAbilityMod(weapon) {
  const scores = getAbilityScores();
  const props = (weapon.properties || []).map(p => p.index);
  if (props.includes('finesse')) return Math.max(mod(scores.strength), mod(scores.dexterity));
  if (weapon.weapon_range === 'Ranged') return mod(scores.dexterity);
  return mod(scores.strength);
}

function weaponBonus(weapon) {
  const prof = parseInt(document.getElementById('proficiency_bonus').value) || 2;
  return fmtMod(weaponAbilityMod(weapon) + prof);
}

function weaponDamage(weapon) {
  if (!weapon.damage) return '';
  const abilityMod = weaponAbilityMod(weapon);
  const dice = weapon.damage.damage_dice || '';
  const type = weapon.damage.damage_type?.name || '';
  const modStr = abilityMod !== 0 ? fmtMod(abilityMod) : '';
  return `${dice}${modStr} ${type}`.trim();
}

// ── Party / read-only view ──
function setReadOnly(readonly, playerName = '') {
  isReadOnly = readonly;
  const form = document.getElementById('cs-form');
  form.classList.toggle('cs-form--readonly', readonly);
  form.querySelectorAll('input, textarea').forEach(el => {
    if (el.type === 'checkbox') {
      el.disabled = readonly;
    } else {
      el.readOnly = readonly;
    }
  });
  document.getElementById('cs-save-bar').classList.toggle('hidden', readonly);
  document.getElementById('cs-readonly-banner').classList.toggle('hidden', !readonly);
  if (readonly) {
    document.getElementById('cs-readonly-player-name').textContent = playerName;
  }
  renderSpellSlots();
}

async function loadPlayers() {
  const res = await fetch('/api/players');
  if (!res.ok) return;
  const players = await res.json();
  const sel = document.getElementById('player-select');
  sel.innerHTML = '<option value="">— Select a player —</option>';
  for (const p of players) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.username;
    sel.appendChild(opt);
  }
}

async function onPlayerSelect(userId) {
  const list = document.getElementById('party-char-list');
  list.innerHTML = '';
  if (!userId) return;
  const sel = document.getElementById('player-select');
  const playerName = sel.options[sel.selectedIndex].text;
  const res = await fetch('/api/players/' + userId + '/characters');
  if (!res.ok) return;
  const chars = await res.json();
  for (const c of chars) {
    const li = document.createElement('li');
    li.className = 'char-list-item';
    li.dataset.charId = c.id;
    li.textContent = c.character_name || '(Unnamed)';
    const sub = document.createElement('span');
    sub.className = 'char-list-sub';
    sub.textContent = [c.class_level, c.race].filter(Boolean).join(' · ');
    li.appendChild(sub);
    li.onclick = () => loadPartyCharacter(userId, c.id, playerName);
    list.appendChild(li);
  }
  if (chars.length === 0) {
    const li = document.createElement('li');
    li.className = 'char-list-empty';
    li.textContent = 'No characters yet.';
    list.appendChild(li);
  }
}

async function loadPartyCharacter(userId, charId, playerName) {
  const res = await fetch('/api/players/' + userId + '/characters/' + charId);
  if (!res.ok) return;
  const sheet = await res.json();
  closeSidebar();

  currentId = null;
  document.querySelectorAll('#char-list .char-list-item').forEach(li => li.classList.remove('active'));
  document.querySelectorAll('#party-char-list .char-list-item').forEach(li => {
    li.classList.toggle('active', li.dataset.charId === String(charId));
  });

  document.getElementById('cs-empty').classList.add('hidden');
  document.getElementById('cs-form').classList.remove('hidden');

  const textFields = [
    'character_name','class_level','background','player_name','race','alignment',
    'experience_points','inspiration','proficiency_bonus',
    'strength','dexterity','constitution','intelligence','wisdom','charisma',
    'armor_class','initiative','speed','max_hp','current_hp','temp_hp','hit_dice',
    'cp','sp','ep','gp','pp','equipment',
    'personality_traits','ideals','bonds','flaws','features_traits',
    'backstory','allies_organizations','additional_features','treasure'
  ];
  for (const f of textFields) {
    const el = document.getElementById(f);
    if (el) el.value = sheet[f] ?? '';
  }

  const checkFields = [
    'save_str','save_dex','save_con','save_int','save_wis','save_cha',
    'skill_acrobatics','skill_animal_handling','skill_arcana','skill_athletics',
    'skill_deception','skill_history','skill_insight','skill_intimidation',
    'skill_investigation','skill_medicine','skill_nature','skill_perception',
    'skill_performance','skill_persuasion','skill_religion','skill_sleight_of_hand',
    'skill_stealth','skill_survival'
  ];
  for (const f of checkFields) {
    const el = document.getElementById(f);
    if (el) el.checked = sheet[f] === 1;
  }

  const success = sheet.death_save_success || 0;
  const fail = sheet.death_save_fail || 0;
  document.querySelectorAll('[data-death="success"]').forEach((cb, i) => cb.checked = i < success);
  document.querySelectorAll('[data-death="fail"]').forEach((cb, i) => cb.checked = i < fail);

  try { attacks = JSON.parse(sheet.attacks || '[]'); } catch { attacks = []; }
  renderAttacks();
  try { spells = JSON.parse(sheet.spells || '[]'); } catch { spells = []; }
  renderSpells();
  try { spellSlots = JSON.parse(sheet.spell_slots || '[]'); } catch { spellSlots = []; }
  while (spellSlots.length < 9) spellSlots.push({pips: Array(4).fill(false)});
  spellSlots = spellSlots.map(s => s.pips ? s : {pips: Array(4).fill(false).map((_, i) => i < (s.used || 0))});

  recalc();
  setStatus('');
  setReadOnly(true, playerName);
}

// ── Delete ──
async function deleteCharacter(id) {
  const targetId = id ?? currentId;
  if (!targetId) return;
  const charName = document.querySelector(`#char-list .char-list-item[data-char-id="${targetId}"]`)?.firstChild?.textContent?.trim() || 'this character';
  if (!confirm(`Delete ${charName}? This cannot be undone.`)) return;
  await fetch('/api/characters/' + targetId, { method: 'DELETE' });
  if (targetId === currentId) {
    currentId = null;
    document.getElementById('cs-form').classList.add('hidden');
  }
  await loadCharList();
}

// ── Number steppers ──
function stepNum(input, delta) {
  if (input.readOnly || input.disabled) return;
  const min = input.min !== '' ? parseInt(input.min) : -Infinity;
  const max = input.max !== '' ? parseInt(input.max) : Infinity;
  const next = Math.min(max, Math.max(min, (parseInt(input.value) || 0) + delta));
  if (next.toString() !== input.value) {
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function initNumSteppers() {
  document.querySelectorAll('input[type="number"]').forEach(input => {
    if (input.closest('.num-stepper')) return;
    const isInline = input.classList.contains('ability-score')
                  || input.classList.contains('mini-input')
                  || input.classList.contains('combat-input');
    const wrapper = document.createElement('div');
    wrapper.className = 'num-stepper' + (isInline ? ' num-stepper--inline' : '');
    const inc = document.createElement('button');
    inc.type = 'button';
    inc.className = 'step-btn step-btn--inc';
    inc.textContent = '▲';
    inc.addEventListener('click', () => stepNum(input, 1));
    const dec = document.createElement('button');
    dec.type = 'button';
    dec.className = 'step-btn step-btn--dec';
    dec.textContent = '▼';
    dec.addEventListener('click', () => stepNum(input, -1));
    const stack = document.createElement('div');
    stack.className = 'step-stack';
    stack.appendChild(inc);
    stack.appendChild(dec);
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.appendChild(stack);
  });
}

// ── Wire up all inputs ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-field]').forEach(el => {
    const ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      recalc();
      scheduleSave();
    });
  });

  document.querySelectorAll('[data-death]').forEach(el => {
    el.addEventListener('change', () => scheduleSave());
  });

  initNumSteppers();
  loadPlayers();
});
