# Stack & Files

> **Update this file when:** the tech stack changes · a file is added, moved, or deleted · a Key Element ID is added or removed · Key Conventions change.

## Stack
Node.js (CommonJS) · Express 5 · better-sqlite3 · express-session + bcryptjs · crypto (built-in, used for dice RNG seeding) · Vanilla JS, no build step

## File Map
```
server.js               — bootstrap: middleware, mount routers, start/shutdown
db.js                   — open DB connection, run schema init, export instance
db/
  schema.js             — CREATE TABLE statements + migrations (called once at startup)
lib/
  history.js            — logHistory(userId, username, action, opts): writes a row to loot_history; used by characters.js and loot.js
middleware/
  auth.js               — requireAuth / requireAdmin / requireBotOrAuth middleware; see docs/auth.md
routes/
  auth.js               — POST /api/guest|register|login|logout · GET /api/me
  characters.js         — CRUD /api/characters[/:id] · owns ALLOWED_FIELDS list
  monsters.js           — CRUD /api/monsters[/:id] · per-user monster tracking · admin-only
  party.js              — GET /api/players · /api/players/:userId/characters[/:charId]
  dice.js               — POST /api/dice/roll · GET /api/dice/rolls · GET /api/dice/users
  loot.js               — CRUD /api/loot[/:id] · GET|PUT /api/loot/money · requireBotOrAuth
  pages.js              — all page GET routes; see docs/auth.md for access policy
public/
  login.html            — auth page (login / register / guest tabs)
  index.html            — home/welcome page
  character-sheet.html  — markup only; loads js/character-sheet.js
  monsters.html         — monster tracker page; loads js/monsters.js
  dice-roll.html        — dice roller page; loads js/dice-roll.js
  loot.html             — party loot page; loads js/loot.js
  history.html          — admin-only change history page; loads js/history.js
  js/
    utils.js            — shared helpers (escHtml)
    character-sheet.js  — all frontend state + functions
    monsters.js         — monster list, CRUD, HP bar, attacks table
    dice-roll.js        — dice type/count selector, roll, result display, roll history
    loot.js             — party money (pp/gp/ep/sp/cp) + transaction UI, loot item table, notes popup
    history.js          — admin-only change history; fetches /api/loot/history, renders audit table
  style.css             — single CSS file, all styles; CSS custom props defined in :root
data.db                 — SQLite binary (do not edit directly)
bot/                    — Discord bot (separate Node process, own package.json)
  index.js              — entry point: Discord client, command loader, interactionCreate handler
  deploy-commands.js    — one-time script: registers slash commands with Discord REST API
  .env.example          — template for BOT_TOKEN, CLIENT_ID, GUILD_ID, BOT_API_KEY, WEBAPP_URL
  lib/
    api.js              — fetch wrapper: prepends WEBAPP_URL, injects x-bot-api-key + x-target-user-id
    links.js            — getWebAppUserId / setLink / resolveUsername — reads/writes data/links.json
    dice.js             — parseDiceExpr: parses "2d6+3" → {diceType, count, modifier}
  commands/
    roll.js             — /roll <expression>
    link.js             — /link <username>
    character.js        — /character view · hp · spellslots · conditions add/remove/get
    loot.js             — /loot view · add · remove · money
    party.js            — /party (all linked members' HP + conditions)
  data/
    links.json          — {discordUserId → webAppUserId} (runtime, gitignored)
docs/                   — domain documentation (this directory)
```

## Key Element IDs

IDs on action buttons whose CSS class is shared across elements, making grep by class noisy.

> **Update this table** when a new button/element is added whose `id` is unique but whose CSS `class` is shared. Use `grep id="<id>"` to jump directly to the element.

| id | file | element |
|----|------|---------|
| `btn-login-submit` | `login.html` | Login form submit |
| `btn-register-submit` | `login.html` | Register form submit |
| `btn-guest-skip` | `login.html` | Guest / skip login |
| `btn-new-char` | `character-sheet.html` | Sidebar "+ New" character button |
| `create-char-cta` | `character-sheet.html` | Empty-state "Create your first character" |
| `btn-apply-damage` | `character-sheet.html` | Apply damage to character HP |
| `btn-mn-apply-damage` | `monsters.html` | Apply damage to monster HP |
| `btn-add-attack` | `character-sheet.html`, `monsters.html` | "+ Add Attack" row button |
| `btn-add-spell` | `character-sheet.html` | "+ Add Spell" row button |
| `btn-new-monster` | `monsters.html` | Sidebar "+ New" monster button |
| `create-monster-cta` | `monsters.html` | Empty-state "Add your first monster" |
| `btn-delete-monster` | `monsters.html` | Delete current monster (save bar) |
| `btn-delete-all-monsters` | `monsters.html` | Delete all monsters (sidebar footer) |
| `roll-btn` | `dice-roll.html` | Primary roll CTA |
| `refresh-btn` | `dice-roll.html` | Refresh history |

## Key Conventions
- DB queries are synchronous (better-sqlite3); only auth routes use async/await (bcrypt)
- `user_id` always stored as `String(req.session.userId)` — ensures `'guest'` works as key
- Checkbox fields: DB stores 0/1; JS reads `el.checked ? 1 : 0` / `sheet[f] === 1`
- `attacks`, `spells`, `spell_slots`: JSON strings; parse with try/catch, fallback to `[]`
- Auto-save: any `data-field` change → `recalc()` + `scheduleSave()` (1200ms debounce); monsters use same 1200ms pattern
- PUT uses explicit `ALLOWED_FIELDS` list in `routes/characters.js` and `routes/monsters.js`
- `timeAgo()` is defined locally in `dice-roll.js` rather than in `utils.js`

## Running
```
npm start   # node server.js → http://localhost:3000
```
