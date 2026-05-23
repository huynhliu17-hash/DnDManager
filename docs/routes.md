# API Routes

> **Update this file** whenever a route is added, removed, or its path/method/auth changes. Note any ordering constraints (e.g. static paths registered before `/:id`) — these are load-bearing and must be preserved.

## Auth (`routes/auth.js`, mounted at `/api`)
| method | path | notes |
|--------|------|-------|
| POST | /api/guest | sets session userId='guest' |
| POST | /api/register | username required, password optional |
| POST | /api/login | password optional if account has no hash |
| POST | /api/logout | destroys session |
| GET | /api/me | returns `{username, guest, admin}` or 401 |

> `/api/me` returns 401 JSON (not a redirect) — it uses a manual session check, not `requireAuth` middleware.

## Characters (`routes/characters.js`, mounted at `/api/characters`)
| method | path | notes |
|--------|------|-------|
| GET | /api/characters | list: id, character_name, class_level, race, updated_at |
| POST | /api/characters | create empty sheet, return full row |
| GET | /api/characters/:id | full sheet, 404 if not owned |
| PUT | /api/characters/:id | partial update via ALLOWED_FIELDS, sets updated_at; `requireBotOrAuth`; accepts `x-target-user-id` header when bot is caller; ALLOWED_FIELDS includes `conditions` (JSON string) |
| DELETE | /api/characters/:id | 404 if not owned |

## Monsters (`routes/monsters.js`, mounted at `/api/monsters`)
| method | path | notes |
|--------|------|-------|
| GET | /api/monsters | list: id, name, ac, current_hp, max_hp; ordered by name |
| POST | /api/monsters | create empty monster, return full row |
| GET | /api/monsters/:id | full row, 404 if not owned |
| PUT | /api/monsters/:id | partial update via ALLOWED_FIELDS, sets updated_at |
| DELETE | /api/monsters | delete all monsters for current user |
| DELETE | /api/monsters/:id | 404 if not owned |

## Dice (`routes/dice.js`, mounted at `/api/dice`)
| method | path | notes |
|--------|------|-------|
| POST | /api/dice/roll | body: `{diceType, count}`; returns `{id,diceType,diceCount,results,total}`; `requireBotOrAuth` |
| GET | /api/dice/rolls | last 10 rolls from all users; returns array |
| GET | /api/dice/rolls?user=`<username>` | last 10 rolls for a specific user |
| GET | /api/dice/users | all distinct usernames that have rolls; returns string array |

> **RNG:** Squirrel noise (hash-based PRNG, `routes/dice.js:16-24`), seeded per-batch from `crypto.randomBytes(4)` XOR-ed with `process.hrtime.bigint()`. Not `Math.random()`.

## Loot (`routes/loot.js`, mounted at `/api/loot`)

> All loot routes use `requireBotOrAuth` (bot or logged-in user). Loot and character PUT routes write audit rows via `logHistory` (`lib/history.js`).
| method | path | notes |
|--------|------|-------|
| GET | /api/loot/history | admin-only; last 500 `loot_history` rows newest-first |
| GET | /api/loot/money | returns `{cp,sp,ep,gp,pp}` |
| PUT | /api/loot/money | body: `{cp,sp,ep,gp,pp}`; updates single party_money row; logs changed coins |
| GET | /api/loot | all loot items ordered by created_at |
| POST | /api/loot | create empty item; returns full row; logs `create` |
| PUT | /api/loot/:id | partial update via ALLOWED_FIELDS; logs each changed field |
| DELETE | /api/loot/:id | delete item; logs `delete` |

> **Ordering constraint:** `/api/loot/history` and `/api/loot/money` must be registered before `/:id` to avoid route shadowing.

## Party (`routes/party.js`, mounted at `/api/players`)

> All party routes use `requireBotOrAuth`. When bot calls `/api/players`, `WHERE id != 'bot'` returns all real users (bot userId is a non-integer string).

| method | path | notes |
|--------|------|-------|
| GET | /api/players | other registered users; guests get `[]` |
| GET | /api/players/:userId/characters | list chars for any user; returns `id, character_name, class_level, race` (no `updated_at`) |
| GET | /api/players/:userId/characters/:charId | full sheet, no ownership check |

## Pages (`routes/pages.js`, mounted at `/`)
| method | path | auth | notes |
|--------|------|------|-------|
| GET | / | requireAuth | home page |
| GET | /character-sheet | requireAuth | character sheet |
| GET | /dice-roll | requireAuth | dice roller |
| GET | /loot | requireAuth | party loot |
| GET | /monsters | requireAdmin | monster tracker |
| GET | /history | requireAdmin | change history |
