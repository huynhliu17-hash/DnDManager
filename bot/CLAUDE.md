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
    links.js          — getWebAppUserId / setLink / getActiveSheetId / setActiveSheetId / verifyCredentials
                        reads/writes data/links.json + data/active_sheets.json; verifyCredentials hits /api/bot/verify-credentials
    dice.js           — parseDiceExpr(expr): parses "2d6+3" or "2d6+3+5-1" → {diceType, count, modifier} or null; sums chained modifiers
  commands/
    link.js           — /link <username> [password]: links Discord ID to web app account; writes links.json
    roll.js           — /roll <expression>: parses dice expr, calls POST /api/dice/roll, shows result publicly
    character.js      — /char view · hp · slots · select · create; customIdPrefix 'cc'; handleComponent for wizard buttons/modals
    cond.js           — /cond add · remove · get · tick: manage conditions on any party character
    loot.js           — /loot view · add · remove · money
    party.js          — /party: shows all linked members' character name, HP bar, and active conditions
    lookup.js         — /lookup spell|feat|feature <name>: 5e API reference lookup with autocomplete
    resource.js       — /res rage|sd use|recover|set [amount]: adjust rage uses or superiority dice
    dndcommands.js    — /dndcommands: list all bot commands with one-line descriptions (ephemeral)
  scripts/
    seed-dnd-index.js — one-time script: fetches 5e API name lists → data/dnd5e-index.json
  lib/
    dnd5e.js          — fuzzySearch(type, query): filter cached index; fetchDetail(url): GET 5e API detail
  data/
    links.json        — {discordUserId → webAppUserId} map; runtime file, gitignored
    active_sheets.json — {discordUserId → characterSheetId} map; runtime file, gitignored
    dnd5e-index.json  — cached spell/feat/feature name lists from 5e API; gitignored; regenerate with seed script
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

## Button & Modal Dispatch

`index.js` routes button and modal-submit interactions by the first segment of `customId` (before `:`). To add component handling to a command, export `customIdPrefix` (a short string) and `handleComponent(interaction)` alongside `data` and `execute`.

| Prefix | File | Used for |
|--------|------|----------|
| `cc` | `character.js` | `/char create` wizard buttons and modals |
| `dc` | `dndcommands.js` | `/dndcommands` Prev/Next pagination buttons |

## Setup: 5e Index

Before starting the bot for the first time (and whenever you want to refresh spell/feat/feature data), run:
```
node scripts/seed-dnd-index.js
```
This fetches name lists from `https://www.dnd5eapi.co` and writes `data/dnd5e-index.json`. Requires Node 18+ for the built-in `fetch` API.

## Command Reference

| Command | Visibility | Description |
|---------|-----------|-------------|
| `/link <username> [password]` | ephemeral | Links Discord account to web app user |
| `/roll <expression> [use_sd]` | public | Rolls one or more dice expressions; optional `use_sd` integer spends that many superiority dice from your active sheet and appends the updated count to the reply |
| `/char create` | ephemeral | Step-by-step wizard to create a new character sheet (8 steps, all skippable) |
| `/char select [number]` | ephemeral | List characters (no arg) or set active sheet by number |
| `/char view` | public | Full character sheet embed (active sheet) |
| `/char hp <amount>` | public | Apply heal (+) or damage (–) to HP (active sheet) |
| `/char slots <level> <use\|recover>` | public | Expend or recover a spell slot on active sheet |
| `/cond add <character> <name> <duration>` | ephemeral | Add a condition to a named party character (partial name match) |
| `/cond remove <character> <name>` | ephemeral | Remove a condition from a named party character |
| `/cond get [character]` | public | Show conditions for a character, or all party if omitted |
| `/cond tick` | public | Reduce all numeric condition durations by 1 on all party characters; remove any that hit 0 |
| `/loot view` | public | Party money and item list |
| `/loot add <name> <tag>` | ephemeral | Add a loot item |
| `/loot remove <name>` | ephemeral | Remove a loot item (partial match) |
| `/loot money <add\|subtract> <coin> <amount>` | ephemeral | Adjust party money |
| `/party` | public | All linked members: HP bar + active conditions |
| `/lookup spell <name>` | public | 5e spell reference (autocomplete) |
| `/lookup feat <name>` | public | 5e feat reference (autocomplete) |
| `/lookup feature <name>` | public | 5e class feature reference (autocomplete) |
| `/res rage use [amount]` | public | Spend rage uses (default 1) |
| `/res rage recover [amount]` | public | Recover rage uses (default 1) |
| `/res rage set <amount>` | public | Set rage uses to exact value |
| `/res sd use [amount]` | public | Spend superiority dice (default 1) |
| `/res sd recover [amount]` | public | Recover superiority dice (default 1) |
| `/res sd set <amount>` | public | Set superiority dice to exact value |
| `/dndcommands [all]` | ephemeral (default) | List all bot commands with one-line descriptions; add `all:True` to post publicly; paginated with Prev/Next buttons |

## Data Formats

**spell_slots** — 9-element JSON array, index 0 = level 1. Each element: `{pips: boolean[4]}`. `true` = expended, `false` = available. Filled pips are always at the front (e.g. `[true, true, false, false]` = 2 used, 2 remaining).

**conditions** — JSON array `[{name: string, duration: string}]`. Stored in `character_sheets.conditions`. Adding a condition with the same name (case-insensitive) updates it in place.
