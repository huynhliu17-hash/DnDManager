# DnD Manager

A self-hosted web app for managing a D&D tabletop campaign. Tracks character sheets, monsters, party loot, dice rolls, and an admin audit log — all backed by a single SQLite database and served over a local network.

## Key Pages

| Page | URL | Access |
|------|-----|--------|
| Home | `/` | Any logged-in user |
| Character Sheet | `/character-sheet` | Any logged-in user |
| Dice Roller | `/dice-roll` | Any logged-in user |
| Party Loot | `/loot` | Any logged-in user |
| Monster Tracker | `/monsters` | Admin only |
| Change History | `/history` | Admin only |

### Character Sheet
Full 5e character sheet with all ability scores, saving throws, 18 skill proficiencies, combat stats (AC, HP, initiative, speed), death saves, attacks, spells with slot tracking (levels 1–9), equipment, personal traits, and backstory. Auto-saves 1.2 s after any change.

### Dice Roller
Roll 1–20 dice of type d4/d6/d8/d10/d12/d20/d100. Shows per-die results and total. Party-wide roll history visible to all users; filterable by player. Uses a hash-based PRNG (Squirrel noise) seeded from `crypto.randomBytes`, not `Math.random`.

### Party Loot
Shared party money (cp/sp/ep/gp/pp) with transaction UI. Item table with name, tag, location, value, quantity, and a notes popup. All changes are logged to the audit trail.

### Monster Tracker (Admin)
Per-session monster list with AC, HP bar, and attacks table. Supports bulk delete. Scoped to the admin's session — monsters are not shared.

### Change History (Admin)
Paginated audit log of all loot and money changes: who changed what, from what value to what value, and when.

## Auth

- **Guest** — one-click access; session userId is the string `'guest'`
- **Registered** — username + optional password; passwordless accounts supported
- **Admin** — `is_admin = 1` in the DB; the username `ed` (case-insensitive) is auto-promoted to admin on every server start

Sessions last 24 hours. The app is designed for HTTP on a local network (no HTTPS requirement).

## Project Structure

```
server.js               — Express bootstrap: middleware, routers, startup/shutdown
db.js                   — open SQLite connection, run schema init
db/schema.js            — CREATE TABLE + migrations (runs once at startup)
lib/history.js          — logHistory() helper used by loot and character routes
middleware/auth.js      — requireAuth / requireAdmin middleware
routes/
  auth.js               — register / login / logout / guest / /api/me
  characters.js         — character CRUD
  monsters.js           — monster CRUD (admin-scoped)
  party.js              — read-only view of other players' characters
  dice.js               — roll endpoint + roll history
  loot.js               — loot items, party money, audit history
  pages.js              — all HTML page GET routes
public/
  *.html                — one file per page, markup only
  js/                   — one JS module per page + shared utils.js
  style.css             — all styles, single file, CSS custom properties
data.db                 — SQLite database (do not edit directly)
docs/                   — authoritative domain documentation
```

## Dev Notes

- **Stack:** Node.js (CommonJS) · Express 5 · better-sqlite3 · express-session · bcryptjs · Vanilla JS, no build step
- **DB queries are synchronous** (better-sqlite3); only bcrypt calls use async/await
- **No framework on the frontend** — plain JS, no bundler, no transpilation
- **Auto-save pattern:** any `data-field` change triggers `recalc()` + `scheduleSave()` with a 1200 ms debounce
- **JSON columns:** `attacks`, `spells`, `spell_slots` are stored as JSON strings; always parse with try/catch and fall back to `[]`
- **`user_id` is always a string** — `'guest'` for guests, `String(rowid)` for registered users
- **ALLOWED_FIELDS:** PUT routes in `characters.js` and `monsters.js` only accept fields on an explicit allowlist

## Running

```bash
npm install
npm start      # web app only → http://localhost:3000
npm run dev    # web app + Discord bot together
```

No build step required. The database (`data.db`) is created automatically on first run.

## Discord Bot

A separate Discord bot lives in `bot/`. It runs as a second Node process alongside the web app and lets players use slash commands from Discord.

### Supported commands

| Command | Description |
|---------|-------------|
| `/link <username>` | Link your Discord account to a web app user |
| `/roll <expression>` | Roll dice, e.g. `2d6+3`, `d20` |
| `/character view` | View your character sheet as an embed |
| `/character hp <amount>` | Apply HP change (+heal / -damage) |
| `/character spellslots <level> <use\|recover>` | Expend or recover a spell slot |
| `/character conditions add <name> <duration>` | Add an active condition |
| `/character conditions remove <name>` | Remove a condition (partial match) |
| `/character conditions get` | Show all active conditions |
| `/loot view` | View party money and items |
| `/loot add <name> <tag>` | Add an item to party loot |
| `/loot remove <name>` | Remove an item by name (partial match) |
| `/loot money <add\|subtract> <coin> <amount>` | Adjust a party coin denomination |
| `/party` | All linked members' HP bar and active conditions |

### Setup

1. Create a Discord application and bot at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Generate a long random string for the API key, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Set `BOT_API_KEY=<that-key>` in the **web app** environment (or a `.env` file with dotenv).
4. Copy `bot/.env.example` to `bot/.env` and fill in `BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID`, and the same `BOT_API_KEY`.
5. Install bot dependencies: `cd bot && npm install`
6. Register slash commands once: `node bot/deploy-commands.js`
7. Start both together from the project root: `npm run dev`
   Or separately: `npm start` (web app) and `node bot/index.js` (bot)

Each Discord user must run `/link <username>` once to connect their account to their web app user before using character or loot commands.

## Documentation

Detailed reference docs live in `docs/`:

| File | Contents |
|------|----------|
| `docs/stack-files.md` | Full file map, key element IDs, conventions |
| `docs/schema.md` | All DB tables and columns |
| `docs/routes.md` | All API routes with methods and auth |
| `docs/auth.md` | Session model and page access policy |
| `docs/frontend.md` | Frontend state variables and notable details |
| `bot/CLAUDE.md` | Bot file map, env vars, auth model, command reference |
