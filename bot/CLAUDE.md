# Bot Reference

**Always grep first** — use function index comments at the top of each file to locate the exact lines before reading the whole file.

The Discord bot is a **separate Node process** from the web server. It communicates with the web app exclusively via the HTTP API using a shared `BOT_API_KEY`.

## File Map

```
bot/
  index.js            — Discord client setup; loads all commands from commands/; dispatches interactionCreate
  deploy-commands.js  — one-time script: registers slash commands with Discord's REST API (run after adding/changing commands)
  .env                — secrets (gitignored); see .env.example for required keys
  .env.example        — BOT_TOKEN, CLIENT_ID, GUILD_ID, BOT_API_KEY, WEBAPP_URL
  package.json        — dependencies: discord.js, dotenv
  lib/
    api.js            — api(path, options, targetUserId): fetch wrapper; injects BOT_API_KEY + x-target-user-id header
    links.js          — getWebAppUserId(discordId) / setLink(discordId, userId) / verifyCredentials(username, password)
                        reads/writes data/links.json; verifyCredentials hits /api/bot/verify-credentials
    dice.js           — parseDiceExpr(expr): parses "2d6+3" → {diceType, count, modifier} or null
  commands/
    link.js           — /link <username> [password]: links Discord ID to web app account; writes links.json
    roll.js           — /roll <expression>: parses dice expr, calls POST /api/dice/roll, shows result publicly
    character.js      — /character view · hp · spellslots · conditions add/remove/get
    loot.js           — /loot view · add · remove · money
    party.js          — /party: shows all linked members' character name, HP bar, and active conditions
  data/
    links.json        — {discordUserId → webAppUserId} map; runtime file, gitignored
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Discord bot token |
| `CLIENT_ID` | Discord application client ID |
| `GUILD_ID` | Discord server (guild) ID to register commands to |
| `BOT_API_KEY` | Shared secret matching the web server's `BOT_API_KEY` env var |
| `WEBAPP_URL` | Base URL of the web server, e.g. `http://localhost:3000` |

## Auth Model

The bot authenticates to the web server via `x-bot-api-key` header (checked by `requireBotOrAuth` middleware). Per-user actions also send `x-target-user-id` so the server applies ownership rules for the right user. Discord IDs are never sent to the server — only the linked web app user ID.

Linking is done with `/link` and stored in `data/links.json`. `getWebAppUserId(discordId)` is called at the top of every per-user command handler.

## Adding a New Command

1. Create `commands/<name>.js` exporting `{ data: SlashCommandBuilder, execute(interaction) }`.
2. Add a one-line entry to the file map above and to `docs/stack-files.md` in the root project.
3. Run `node deploy-commands.js` to register it with Discord before testing.

## Command Reference

| Command | Visibility | Description |
|---------|-----------|-------------|
| `/link <username> [password]` | ephemeral | Links Discord account to web app user |
| `/roll <expression>` | public | Rolls dice, shows all results + total |
| `/character view` | public | Full character sheet embed |
| `/character hp <amount>` | public | Apply heal (+) or damage (–) to HP |
| `/character spellslots <level> <use\|recover>` | public | Expend or recover a spell slot; syncs with web app |
| `/character conditions add <name> <duration>` | ephemeral | Add a condition with duration |
| `/character conditions remove <name>` | ephemeral | Remove a condition (partial match) |
| `/character conditions get` | public | Show all active conditions + durations |
| `/loot view` | public | Party money and item list |
| `/loot add <name> <tag>` | ephemeral | Add a loot item |
| `/loot remove <name>` | ephemeral | Remove a loot item (partial match) |
| `/loot money <add\|subtract> <coin> <amount>` | ephemeral | Adjust party money |
| `/party` | public | All linked members: HP bar + active conditions |

## Data Formats

**spell_slots** — 9-element JSON array, index 0 = level 1. Each element: `{pips: boolean[4]}`. `true` = expended, `false` = available. Filled pips are always at the front (e.g. `[true, true, false, false]` = 2 used, 2 remaining).

**conditions** — JSON array `[{name: string, duration: string}]`. Stored in `character_sheets.conditions`. Adding a condition with the same name (case-insensitive) updates it in place.
