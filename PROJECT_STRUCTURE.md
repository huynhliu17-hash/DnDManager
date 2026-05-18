# PROJECT_STRUCTURE

## Stack
Node.js (CommonJS) · Express 5 · better-sqlite3 · express-session + bcryptjs · Vanilla JS, no build step

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
  pages.js              — GET / · GET /character-sheet (requireAuth) · GET /monsters (requireAdmin)
public/
  login.html            — auth page (login / register / guest tabs)
  index.html            — home/welcome page
  character-sheet.html  — markup only; loads js/character-sheet.js
  monsters.html         — monster tracker page; loads js/monsters.js
  js/
    character-sheet.js  — all frontend state + functions
    monsters.js         — monster list, CRUD, HP bar, attacks table
  style.css             — single CSS file, all styles, CSS vars
data.db                 — SQLite binary (do not edit directly)
```

## DB Schema

### users
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| username | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT | nullable — passwordless accounts allowed |
| is_admin | INTEGER NOT NULL DEFAULT 0 | 1 = admin; new accounts always get 0 |
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
| spells | TEXT DEFAULT '[]' | JSON: `[{name,level,notes,description,custom}]` |
| spell_slots | TEXT DEFAULT '[]' | JSON: 9 items `[{pips:[bool×4]}]` indexed 1–9 |
| cp, sp, ep, gp, pp | INTEGER DEFAULT 0 | |
| equipment, personality_traits, ideals, bonds, flaws, features_traits | TEXT DEFAULT '' | |
| backstory, allies_organizations, additional_features, treasure | TEXT DEFAULT '' | |
| created_at, updated_at | DATETIME | `updated_at` set on every PUT |

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
| DELETE | /api/monsters/:id | 404 if not owned |

### Party (`routes/party.js`, mounted at `/api/players`)
| method | path | notes |
|--------|------|-------|
| GET | /api/players | other registered users; guests get `[]` |
| GET | /api/players/:userId/characters | list chars for any user |
| GET | /api/players/:userId/characters/:charId | full sheet, no ownership check |

## Auth Model
- `requireAuth` (`middleware/auth.js`): checks `req.session.userId`, redirects to `/login.html` if missing
- `requireAdmin` (`middleware/auth.js`): same as above + requires `req.session.isAdmin === true`; returns 403 JSON if authenticated but not admin
- `userId` stored as string: guest=`'guest'`, users=`String(lastInsertRowid)`
- `isAdmin` stored in session as boolean; set on login/register from `users.is_admin`
- New accounts always have `is_admin = 0`; admin must be granted directly in the DB
- Passwordless: `password_hash=NULL`; login checks username exists only
- Session: 24h maxAge, secure:false (HTTP/LAN only)

## Page Access Policy
Every page route must use `requireAuth` (all logged-in users) or `requireAdmin` (admins only). No page may be added without choosing one.
- `/` and `/character-sheet` — `requireAuth`
- `/monsters` — `requireAdmin`

## Frontend (`public/js/character-sheet.js`)

### State
| var | description |
|-----|-------------|
| `currentUser` | `{username, guest}` from `/api/me` |
| `currentId` | active character id (`null` = party view / none) |
| `isReadOnly` | true when viewing another player's char |
| `attacks` | `[{name,bonus,damage}]` for current char |
| `spells` | `[{name,level,notes,description,custom}]` |
| `spellSlots` | array of 9 `{pips:[bool×4]}` objects |
| `saveTimer` | debounce handle (1200ms) |

### Key Functions
| fn | purpose |
|----|---------|
| `recalc()` | recompute mods, saves, skills, passive perc from DOM |
| `scheduleSave()` | debounce → `saveCharacter()` after 1200ms |
| `saveCharacter()` | PUT /api/characters/:currentId |
| `loadCharacter(id)` | GET + populate form, setReadOnly(false) |
| `loadPartyCharacter(userId,charId,name)` | GET + populate form, setReadOnly(true) |
| `setReadOnly(bool, name)` | toggle inputs disabled/readOnly, hide save bar |
| `createNewCharacter()` | POST (create) then loadCharacter |
| `renderAttacks()` / `renderSpells()` | rebuild table rows |
| `renderSpellSlots()` | rebuild spell slot pip grid (all 9 levels) |
| `openSearchModal(ctx)` | open D&D 5e search popup; ctx = 'attack' or 'spell' |
| `gqlSearchSpells(name)` | POST dnd5eapi.co/graphql |
| `gqlSearchWeapons(name)` | GET dnd5eapi.co/api/equipment-categories/weapon + detail |
| `escHtml(s)` | sanitize strings for innerHTML |
| `loadCharList()` / `loadPlayers()` | refresh sidebar lists |
| `initNumSteppers()` | wrap number inputs with ▲/▼ stepper buttons |

### Data Attribute Conventions
- `data-field="fieldName"` — main sheet inputs; triggers `recalc()` + `scheduleSave()`
- `data-death="success|fail"` + `data-idx` — death save checkboxes

## CSS Variables (`style.css :root`)
```css
--bg: #1a1a2e       --surface: #16213e    --surface2: #0f3460
--accent: #e94560   --accent2: #c4972a    --text: #eaeaea
--text-muted: #888  --border: #2a2a4a     --radius: 8px
```

## Key Conventions
- DB queries are synchronous (better-sqlite3); only auth routes use async/await (bcrypt)
- `user_id` always stored as `String(req.session.userId)` — ensures `'guest'` works as key
- Checkbox fields: DB stores 0/1; JS reads `el.checked ? 1 : 0` / `sheet[f] === 1`
- `attacks`, `spells`, `spell_slots`: JSON strings; parse with try/catch, fallback to `[]`
- Auto-save: any `data-field` change → `recalc()` + `scheduleSave()` (1200ms debounce)
- PUT uses explicit `ALLOWED_FIELDS` list in `routes/characters.js`

## Running
```
npm start   # node server.js → http://localhost:3000
```
