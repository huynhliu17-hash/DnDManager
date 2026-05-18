# PROJECT_STRUCTURE

> Grep `## <Section>` to jump without reading the full file.
> Sections: Stack · File Map · Key Element IDs · DB Schema · API Routes · Auth Model · Page Access Policy · Frontend · Key Conventions · Running

## Stack
Node.js (CommonJS) · Express 5 · better-sqlite3 · express-session + bcryptjs · crypto (built-in, used for dice RNG seeding) · Vanilla JS, no build step

## File Map
```
server.js               — bootstrap: middleware, mount routers, start/shutdown
db.js                   — open DB connection, run schema init, export instance
db/
  schema.js             — CREATE TABLE statements + migrations (called once at startup)
middleware/
  auth.js               — requireAuth: redirects to /login.html if no session
routes/
  auth.js               — POST /api/guest|register|login|logout · GET /api/me
  characters.js         — CRUD /api/characters[/:id] · owns ALLOWED_FIELDS list
  monsters.js           — CRUD /api/monsters[/:id] · per-user monster tracking · admin-only
  party.js              — GET /api/players · /api/players/:userId/characters[/:charId]
  dice.js               — POST /api/dice/roll · GET /api/dice/rolls (last 10, all users)
  pages.js              — GET / · GET /character-sheet (requireAuth) · GET /monsters (requireAdmin) · GET /dice-roll (requireAuth)
public/
  login.html            — auth page (login / register / guest tabs)
  index.html            — home/welcome page
  character-sheet.html  — markup only; loads js/character-sheet.js
  monsters.html         — monster tracker page; loads js/monsters.js
  dice-roll.html        — dice roller page; loads js/dice-roll.js
  js/
    utils.js            — shared helpers (escHtml)
    character-sheet.js  — all frontend state + functions
    monsters.js         — monster list, CRUD, HP bar, attacks table
    dice-roll.js        — dice type/count selector, roll, result display, roll history
  style.css             — single CSS file, all styles; CSS custom props defined in :root
data.db                 — SQLite binary (do not edit directly)
```

## Key Element IDs

IDs on action buttons whose CSS class is shared across elements, making grep by class noisy. Use `grep id="<id>"` to jump directly to the element.

| id | file | element |
|----|------|---------|
| `btn-login-submit` | `login.html` | Login form submit |
| `btn-register-submit` | `login.html` | Register form submit |
| `btn-guest-skip` | `login.html` | Guest / skip login |
| `btn-new-char` | `character-sheet.html` | Sidebar "+ New" character button |
| `create-char-cta` | `character-sheet.html` | Empty-state "Create your first character" |
| `btn-add-attack` | `character-sheet.html`, `monsters.html` | "+ Add Attack" row button |
| `btn-add-spell` | `character-sheet.html` | "+ Add Spell" row button |
| `btn-new-monster` | `monsters.html` | Sidebar "+ New" monster button |
| `create-monster-cta` | `monsters.html` | Empty-state "Add your first monster" |
| `btn-delete-monster` | `monsters.html` | Delete current monster (save bar) |
| `btn-delete-all-monsters` | `monsters.html` | Delete all monsters (sidebar footer) |
| `roll-btn` | `dice-roll.html` | Primary roll CTA |
| `refresh-btn` | `dice-roll.html` | Refresh history |

## DB Schema

### users
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| username | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT | nullable — passwordless accounts allowed |
| is_admin | INTEGER NOT NULL DEFAULT 0 | 1 = admin; new accounts always get 0; *(migration)* — not in initial CREATE TABLE |
| created_at | DATETIME | |

### monsters
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | TEXT NOT NULL | `'guest'` or `String(rowid)` |
| name | TEXT DEFAULT '' | |
| ac | INTEGER DEFAULT 10 | armor class |
| max_hp | INTEGER DEFAULT 0 | |
| current_hp | INTEGER DEFAULT 0 | |
| attacks | TEXT DEFAULT '[]' | JSON: `[{name,bonus,damage}]` |
| created_at, updated_at | DATETIME | `updated_at` set on every PUT |

### character_sheets
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | TEXT NOT NULL | `'guest'` or `String(rowid)` |
| character_name, class_level, background, player_name, race, alignment | TEXT DEFAULT '' | |
| experience_points, inspiration, proficiency_bonus | INTEGER | defaults: 0, 0, 2 |
| strength, dexterity, constitution, intelligence, wisdom, charisma | INTEGER DEFAULT 10 | |
| save_str … save_cha (6) | INTEGER DEFAULT 0 | proficiency checkbox: 0/1 |
| skill_acrobatics … skill_survival (18) | INTEGER DEFAULT 0 | proficiency checkbox: 0/1 |
| armor_class, initiative, speed | INTEGER | defaults: 10, 0, 30 |
| max_hp, current_hp, temp_hp | INTEGER DEFAULT 0 | |
| hit_dice | TEXT DEFAULT '' | e.g. `"5d10"` |
| death_save_success, death_save_fail | INTEGER DEFAULT 0 | count 0–3 |
| attacks | TEXT DEFAULT '[]' | JSON: `[{name,bonus,damage}]` |
| spells | TEXT DEFAULT '[]' | JSON: `[{name,level,notes,description,custom}]`; *(migration)* — not in initial CREATE TABLE |
| spell_slots | TEXT DEFAULT '[]' | JSON: 9 items `[{pips:[bool×4]}]` levels 1–9 (array index 0–8, use `level-1`); *(migration)* — not in initial CREATE TABLE |
| cp, sp, ep, gp, pp | INTEGER DEFAULT 0 | |
| equipment, personality_traits, ideals, bonds, flaws, features_traits | TEXT DEFAULT '' | |
| backstory, allies_organizations, additional_features, treasure | TEXT DEFAULT '' | |
| created_at, updated_at | DATETIME | `updated_at` set on every PUT |

### dice_rolls
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | TEXT NOT NULL | `'guest'` or `String(rowid)` |
| username | TEXT NOT NULL | display name at time of roll |
| dice_type | TEXT NOT NULL | `'d4'`…`'d100'` |
| dice_count | INTEGER NOT NULL | 1–20 |
| results | TEXT NOT NULL | JSON array of individual roll values |
| total | INTEGER NOT NULL | sum of results |
| rolled_at | DATETIME | |

## API Routes

### Auth (`routes/auth.js`, mounted at `/api`)
| method | path | notes |
|--------|------|-------|
| POST | /api/guest | sets session userId='guest' |
| POST | /api/register | username required, password optional |
| POST | /api/login | password optional if account has no hash |
| POST | /api/logout | destroys session |
| GET | /api/me | returns `{username, guest, admin}` or 401 |

### Characters (`routes/characters.js`, mounted at `/api/characters`)
| method | path | notes |
|--------|------|-------|
| GET | /api/characters | list: id, character_name, class_level, race, updated_at |
| POST | /api/characters | create empty sheet, return full row |
| GET | /api/characters/:id | full sheet, 404 if not owned |
| PUT | /api/characters/:id | partial update via ALLOWED_FIELDS, sets updated_at |
| DELETE | /api/characters/:id | 404 if not owned |

### Monsters (`routes/monsters.js`, mounted at `/api/monsters`)
| method | path | notes |
|--------|------|-------|
| GET | /api/monsters | list: id, name, ac, current_hp, max_hp; ordered by name |
| POST | /api/monsters | create empty monster, return full row |
| GET | /api/monsters/:id | full row, 404 if not owned |
| PUT | /api/monsters/:id | partial update via ALLOWED_FIELDS, sets updated_at |
| DELETE | /api/monsters | delete all monsters for current user |
| DELETE | /api/monsters/:id | 404 if not owned |

### Dice (`routes/dice.js`, mounted at `/api/dice`)
| method | path | notes |
|--------|------|-------|
| POST | /api/dice/roll | roll dice; body: `{diceType, count}`; returns `{id,diceType,diceCount,results,total}` |
| GET | /api/dice/rolls | last 10 rolls from all users; returns array |

> **RNG implementation:** Dice are rolled with Squirrel noise (hash-based PRNG, `routes/dice.js:16-24`), seeded per-batch from `crypto.randomBytes(4)` XOR-ed with `process.hrtime.bigint()`. Not `Math.random()`.

### Party (`routes/party.js`, mounted at `/api/players`)
| method | path | notes |
|--------|------|-------|
| GET | /api/players | other registered users; guests get `[]` |
| GET | /api/players/:userId/characters | list chars for any user; returns `id, character_name, class_level, race` (no `updated_at`) |
| GET | /api/players/:userId/characters/:charId | full sheet, no ownership check |

## Auth Model
- `requireAuth` (`middleware/auth.js`): checks `req.session.userId`, redirects to `/login.html` if missing
- `requireAdmin` (`middleware/auth.js`): same as above + requires `req.session.isAdmin === true`; returns 403 JSON if authenticated but not admin
- `userId` stored as string: guest=`'guest'`, users=`String(lastInsertRowid)`
- `isAdmin` stored in session as boolean; set on login/register from `users.is_admin`
- New accounts always have `is_admin = 0`; admin must be granted directly in the DB
- Exception: `db/schema.js` unconditionally sets `is_admin = 1` for any account with username `'ed'` (case-insensitive) at every startup
- Passwordless: `password_hash=NULL`; login checks username exists only
- Session: 24h maxAge, secure:false (HTTP/LAN only)
- `/api/me` does a manual `if (!req.session.userId)` check (returns 401 JSON) rather than `requireAuth` (which would redirect to `/login.html`); all other protected routes use middleware

## Page Access Policy
- `/`, `/character-sheet`, `/dice-roll` — `requireAuth`
- `/monsters` — `requireAdmin`

## Frontend (`public/js/character-sheet.js`)

> Note: file has an accurate function index comment at lines 1–14 that mirrors the groups below.

### State
| var | description |
|-----|-------------|
| `currentUser` | `{username, guest, admin}` from `/api/me` |
| `currentId` | active character id (`null` = party view / none) |
| `isReadOnly` | true when viewing another player's char |
| `saveTimer` | debounce handle for auto-save (1200ms) |
| `attacks` | in-memory array `[{name,bonus,damage}]` for current sheet |
| `spells` | in-memory array `[{name,level,notes,description,custom}]` for current sheet |
| `spellSlots` | 9-element array `[{pips:[bool×4]}]`; index 0 = spell level 1 |
| `searchContext` | `'attack'` or `'spell'`; controls which results flow from the search modal |
| `searchDebounce` | debounce handle for D&D API search input |
| `_weaponListCache` | cached weapon list from dnd5eapi.co (fetched once per session) |
| `_weaponDetailCache` | cached weapon detail objects keyed by index |
| `_dragSrcIdx` | drag-source row index during drag-to-reorder operations |
| `spellPopupIdx` | index of the spell currently open in the description popup (`null` = closed) |

### Key Functions
| fn | purpose |
|----|---------|
| `loadCharList()` | fetch character list from `/api/characters`, populate sidebar, auto-load first |
| `createNewCharacter()` | POST to `/api/characters`, set as active, refresh sidebar |
| `loadCharacter(id)` | GET `/api/characters/:id`, populate all DOM inputs, parse JSON fields |
| `updateCharList()` | re-render sidebar list items without a full reload |
| `saveCharacter()` | PUT current sheet to `/api/characters/:id`; serialises attacks/spells/spellSlots as JSON |
| `deleteCharacter(id?)` | DELETE character by `id`; if omitted, deletes `currentId`; clears state and reloads list |
| `scheduleSave()` | debounce wrapper; clears/restarts 1200ms timer before calling `saveCharacter()` |
| `setStatus(msg)` | update save-status text element |
| `recalc()` | recompute ability mods, saving throws, skills, and passive perception from DOM values |
| `mod(score)` | returns ability modifier for a given score |
| `fmtMod(n)` | formats modifier as `+n` / `-n` string |
| `getAbilityScores()` | returns `{str,dex,con,int,wis,cha}` from DOM inputs |
| `renderAttacks()` | rebuild attacks table rows from `attacks[]` |
| `addAttack()` | push empty entry to `attacks[]`, re-render, schedule save |
| `removeAttack(i)` | splice index from `attacks[]`, re-render, schedule save |
| `renderSpells()` | rebuild spells table rows from `spells[]` |
| `addSpell()` | push empty entry to `spells[]`, re-render, schedule save |
| `removeSpell(i)` | splice index from `spells[]`, re-render, schedule save |
| `renderSpellSlots()` | rebuild spell-slot pip grid; uses `level-1` for array index |
| `toggleSpellSlot(level,pip)` | flip a single pip boolean, re-render, schedule save |
| `bindDragRow(tr)` | attaches dragstart/dragover/drop/dragend handlers to a single `<tr>`; on drop, reads `data-drag-type` to splice `attacks[]` or `spells[]` and re-renders |
| `openSearchModal(ctx)` | open D&D 5e search popup; `ctx = 'attack'` searches weapons, `'spell'` searches spells |
| `closeSearchModal()` | hide search modal, reset state |
| `onSearchOverlayClick(e)` | close modal if click was on overlay (not content) |
| `runDndSearch()` | dispatch to `gqlSearchSpells` or `gqlSearchWeapons` based on `searchContext` |
| `gqlSearchSpells(name)` | POST to dnd5eapi.co/graphql; returns up to 20 matching spells |
| `gqlSearchWeapons(name)` | fetches weapon list (cached) then individual detail per match |
| `renderDndResults(items, ctx, container)` | render search results into `container`; `ctx` controls attack vs spell detail display |
| `selectDndItem(item)` | populate attack or spell row from a D&D API result |
| `addCustomEntry()` | add a blank row from the search modal (no API item) |
| `weaponAbilityMod(props)` | determine STR vs DEX modifier for a weapon |
| `weaponBonus(props)` | compute total attack bonus string |
| `weaponDamage(props)` | compute damage string including ability modifier |
| `openSpellPopup(i)` | open spell-description popup for spell at index `i` |
| `closeSpellPopup()` | close spell popup, clear `spellPopupIdx` |
| `onSpellDescOverlayClick(e)` | close popup if click was on overlay |
| `setReadOnly(bool, name)` | disables inputs, hides save bar, shows readonly banner with player name |
| `loadPartyCharacter(userId,charId,name)` | loads another player's sheet and sets read-only mode |
| `loadPlayers()` | fetch party member list, render player select |
| `onPlayerSelect(userId)` | load character list for selected player in party panel |
| `toggleSidebar()` | toggle mobile sidebar open/closed |
| `closeSidebar()` | close mobile sidebar |
| `toggleLore(bodyId,arrowId)` | expand/collapse lore section; toggles arrow indicator |
| `stepNum(el,delta)` | increment/decrement a numeric stepper input by `delta` |
| `initNumSteppers()` | wire up all `[data-step]` buttons on page load |

### Data Attribute Conventions
- `data-field="fieldName"` — main sheet inputs; triggers `recalc()` + `scheduleSave()`
- `data-death="success|fail"` + `data-idx` — death save checkboxes

### Notable Implementation Details
- Drag-to-reorder: `bindDragRow(tbody, arr)` handles both attacks and spells tables
- Double `/api/me` fetch: one at top-level (sets `currentUser`, shows admin nav, calls `loadCharList`); a second inside `DOMContentLoaded` that only updates `nav-username` — the second is partly redundant

## Frontend (`public/js/monsters.js`)

### State
| var | description |
|-----|-------------|
| `currentId` | id of the currently displayed monster (`null` = none) |
| `saveTimer` | debounce handle for auto-save (1200ms) |
| `monsterAttacks` | in-memory array `[{name,bonus,damage}]` for current monster |

### Key Functions
| fn | purpose |
|----|---------|
| `loadMonsterList()` | GET `/api/monsters`, render sidebar list; auto-loads first monster if none active |
| `createNewMonster()` | POST to `/api/monsters`, set as active, refresh list |
| `loadMonster(id)` | GET `/api/monsters/:id`, call `populateForm()`, highlight active item |
| `populateForm(monster)` | write monster fields into DOM inputs, parse attacks JSON, call `renderAttacks()` + `updateHpBar()` |
| `deleteMonster(e,id)` | confirm + DELETE `/api/monsters/:id`; clear state if was active |
| `deleteCurrentMonster()` | confirm + DELETE current monster via `currentId` |
| `deleteAllMonsters()` | confirm + DELETE `/api/monsters` (all monsters for user) |
| `scheduleSave()` | debounce wrapper; 1200ms before calling `saveMonster()` |
| `saveMonster()` | PUT current monster to `/api/monsters/:id` |
| `updateHpBar()` | set HP bar width + class (`hp-high` >50%, `hp-mid` >25%, `hp-low` ≤25%) |
| `renderAttacks()` | rebuild attacks table rows from `monsterAttacks[]` |
| `addAttack()` | push empty entry, re-render, schedule save |
| `removeAttack(i)` | splice index, re-render, schedule save |
| `toggleSidebar()` | toggle mobile sidebar open/closed |

## Frontend (`public/js/dice-roll.js`)

### State
| var | description |
|-----|-------------|
| `selectedType` | active dice type string, e.g. `'d20'`; default `'d20'` |
| `diceCount` | number of dice to roll; default `1`, clamped 1–20 |

### Key Functions
| fn | purpose |
|----|---------|
| `adjustCount(delta)` | increment/decrement `diceCount` by delta, clamp 1–20, sync buttons |
| `syncCountButtons()` | disable dec/inc buttons at 1/20 boundary |
| `rollDice()` | POST to `/api/dice/roll`, call `showResult()` + `loadHistory()` |
| `showResult(data)` | render individual die pips with min/max highlight classes + total |
| `loadHistory()` | GET `/api/dice/rolls`, call `renderHistory()` |
| `renderHistory(rolls)` | render roll history table rows including relative timestamps |
| `timeAgo(isoStr)` | local relative-time utility (s/m/h/d ago); **candidate to move to `utils.js`** |
| `logout()` | POST `/api/logout`, redirect to `/login.html` |

## Key Conventions
- DB queries are synchronous (better-sqlite3); only auth routes use async/await (bcrypt)
- `user_id` always stored as `String(req.session.userId)` — ensures `'guest'` works as key
- Checkbox fields: DB stores 0/1; JS reads `el.checked ? 1 : 0` / `sheet[f] === 1`
- `attacks`, `spells`, `spell_slots`: JSON strings; parse with try/catch, fallback to `[]`
- Auto-save: any `data-field` change → `recalc()` + `scheduleSave()` (1200ms debounce); monsters use same 1200ms pattern
- PUT uses explicit `ALLOWED_FIELDS` list in `routes/characters.js`
- `timeAgo()` is defined locally in `dice-roll.js` rather than in `utils.js`; candidate for centralisation if future pages need relative timestamps

## Running
```
npm start   # node server.js → http://localhost:3000
```
