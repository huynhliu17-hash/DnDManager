# Discord Bot Integration Plan

## Context

The DnD Manager web app runs locally on Ed's PC and is used by 3–5 players in-session via a browser. The goal is to add a Discord bot so the same group can interact with the app from their Discord server during or between sessions — rolling dice, checking loot/money, viewing character info, and updating HP and loot items.

The bot will run as a second Node.js process on Ed's machine, alongside the web app, and communicate with it via HTTP on localhost. Discord users (on their own PCs/internet) send slash commands to Discord; Discord forwards them to the bot; the bot calls the web app API.

---

## Architecture

### Authentication: Static API key in a request header

Add a `BOT_API_KEY` env var to the web app. The bot sends `x-bot-api-key: <key>` on every request. A new `requireBotOrAuth` middleware in `middleware/auth.js` accepts either a valid API key OR a live session — this is the only auth change needed.

When the bot authenticates via API key, the middleware sets `req.session.userId = 'bot'` and `req.session.username = 'Discord Bot'` for the duration of the request (transient — not persisted because `saveUninitialized: false`). Loot/character history entries will show "Discord Bot" as the actor.

For character writes, the bot passes an additional `x-target-user-id` header (the web app user's numeric ID) so the `PUT /api/characters/:id` ownership check uses the correct user — not `'bot'`.

### User linking: JSON file

A `/link <webappusername>` command stores `{ discordUserId → webAppUserId }` in `bot/data/links.json`. The bot resolves usernames by calling `GET /api/players` (the bot's session userId is `'bot'`, a non-integer string, so `WHERE id != 'bot'` returns all real users correctly).

### Separate bot package

The bot lives in `bot/` with its own `package.json` and `node_modules`. This keeps `discord.js` (large) out of the web app's dependencies. Both processes start independently.

---

## Web App Changes (minimum surface)

### 1. `middleware/auth.js`
Add `requireBotOrAuth` and export it:
```js
function requireBotOrAuth(req, res, next) {
  const key = req.headers['x-bot-api-key'];
  if (key && key === process.env.BOT_API_KEY) {
    req.session.userId = 'bot';
    req.session.username = 'Discord Bot';
    return next();
  }
  return requireAuth(req, res, next);
}
```

### 2. `routes/characters.js`
- Change `require('../middleware/auth')` import to also pull in `requireBotOrAuth`.
- On `PUT /:id`: resolve effective user ID from `x-target-user-id` header when the bot is the caller:
  ```js
  const userId = req.session.userId === 'bot' && req.headers['x-target-user-id']
    ? String(req.headers['x-target-user-id'])
    : String(req.session.userId);
  ```
  Switch that route's middleware from `requireAuth` to `requireBotOrAuth`.

### 3. `routes/loot.js`
- Change `router.use(requireAuth)` to `router.use(requireBotOrAuth)`. Import the new middleware.

### 4. `routes/dice.js`
- Change `POST /roll` middleware from `requireAuth` to `requireBotOrAuth`. Import the new middleware.

### 5. `routes/party.js`
- Change `requireAuth` to `requireBotOrAuth` on all three routes (needed for the `/link` command to resolve usernames).

### 6. `BOT_API_KEY` env var
Set `BOT_API_KEY=<long-random-string>` in the shell before starting the web app (or add a `.env` file with dotenv). Use the same value in `bot/.env`.

---

## Bot Directory Structure

```
bot/
  package.json            — {discord.js, dotenv} only
  .env                    — BOT_TOKEN, BOT_API_KEY, CLIENT_ID, GUILD_ID, WEBAPP_URL=http://localhost:3000
  .gitignore              — .env, data/, node_modules/
  deploy-commands.js      — one-time script: registers slash commands with Discord
  index.js                — entry point: init Client, load commands, listen for interactions
  data/
    links.json            — { "discordUserId": "webAppUserId" }  (runtime, gitignored)
  lib/
    api.js                — fetch wrapper: prepends WEBAPP_URL, injects x-bot-api-key + x-target-user-id
    links.js              — getWebAppUserId(discordId), setLink(discordId, webAppUserId), resolveUsername(name)
    dice.js               — parseDiceExpr("2d6+3") → { diceType: 'd6', count: 2, modifier: 3 }
  commands/
    roll.js               — /roll
    link.js               — /link
    character.js          — /character (subcommands: view, hp)
    loot.js               — /loot (subcommands: view, add, remove, money)
```

---

## Slash Commands

| Command | Options | Description |
|---------|---------|-------------|
| `/roll [expression]` | `expression: string` e.g. `2d6+3` | Rolls dice, posts individual results + total publicly. Modifier (+N/-N) applied client-side after the API call. |
| `/link [username]` | `username: string` | Links the caller's Discord account to a web app user. Fetches `/api/players` to resolve the ID. Ephemeral reply. |
| `/character view` | *(none — uses linked account)* | Embed: character name, race/class, AC, HP (current/max), six ability scores. |
| `/character hp [amount]` | `amount: integer` (+heal / -damage) | Fetches current HP, clamps to 0–max, PUTs new value. Embed shows old → new HP. |
| `/loot view` | *(none)* | Embed: party money (pp/gp/ep/sp/cp) + item table (name, qty, value, location). Truncated at 4000 chars. |
| `/loot add [name] [tag]` | `name: string`, `tag: choice` | POSTs new loot item, then PUTs to set name and tag. |
| `/loot remove [name]` | `name: string` (partial match) | Finds item by name, DELETEs it. Confirms first if multiple matches. |
| `/loot money [coin] [amount]` | `coin: choice (gp/sp/cp/ep/pp)`, `amount: integer` | Fetches current money, updates one denomination, PUTs full object. |

---

## Implementation Order

1. **Create `bot/` scaffold** — `package.json`, `.env`, `.gitignore`, directory skeleton, `data/links.json = {}`
2. **Implement `bot/lib/api.js`** — fetch wrapper with headers
3. **Implement `bot/lib/links.js`** — read/write `links.json`
4. **Implement `bot/lib/dice.js`** — expression parser and validator
5. **Modify web app** — `middleware/auth.js`, `routes/characters.js`, `routes/loot.js`, `routes/dice.js`, `routes/party.js`
6. **Implement commands** in order: `roll.js` → `link.js` → `character.js` → `loot.js`
7. **Implement `bot/index.js`** — Client, command loader, interactionCreate listener
8. **Implement `bot/deploy-commands.js`** — REST registration script
9. **Update `docs/` and `README.md`** with bot setup instructions

---

## Verification

1. Start web app: `node server.js` (with `BOT_API_KEY=test-key` in env)
2. Register commands once: `node bot/deploy-commands.js`
3. Start bot: `node bot/index.js`
4. In Discord:
   - `/link ed` → confirms "Linked to ed"
   - `/roll 2d6+3` → shows 2 individual die values + total with modifier
   - `/character view` → embed with HP and stats
   - `/character hp -5` → shows HP drop; verify change in web app character sheet
   - `/loot view` → shows party money and items
   - `/loot add "Healing Potion" Potion` → item appears in web app loot page
   - `/loot money gp 150` → money updates in web app loot page
5. Check `/history` admin page — all bot-initiated changes should show "Discord Bot" as actor
