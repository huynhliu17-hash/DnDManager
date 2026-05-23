# Auth Model & Page Access Policy

> **Update this file** when auth behavior or session logic changes, when middleware is added or modified, when a page's access level changes, or when the hardcoded bootstrap grant in `db/schema.js` changes. Also update the `## Page Access Policy` section in `CLAUDE.md` (the behavioral rule lives there; this file is the reference copy).

## Auth Model
- `requireAuth` (`middleware/auth.js`): checks `req.session.userId`, redirects to `/login.html` if missing
- `requireAdmin` (`middleware/auth.js`): same as above + requires `req.session.isAdmin === true`; returns 403 JSON if authenticated but not admin
- `requireBotOrAuth` (`middleware/auth.js`): accepts a valid `x-bot-api-key` header (checked against `BOT_API_KEY` env var) OR a live session; sets `req.session.userId='bot'` and `req.session.username='Discord Bot'` for the request duration (transient — not persisted). Used on routes the Discord bot needs to call.
- `userId` stored as string: guest=`'guest'`, users=`String(lastInsertRowid)`, bot=`'bot'`
- `isAdmin` stored in session as boolean; set on login/register from `users.is_admin`
- New accounts always have `is_admin = 0`; admin must be granted directly in the DB
- Exception: `db/schema.js` unconditionally sets `is_admin = 1` for any account with username `'ed'` (case-insensitive) at every startup
- Passwordless: `password_hash=NULL`; login checks username exists only
- Session: 24h maxAge, secure:false (HTTP/LAN only)
- `/api/me` does a manual `if (!req.session.userId)` check (returns 401 JSON) rather than `requireAuth` (which would redirect); all other protected routes use middleware

## Page Access Policy
- `/`, `/character-sheet`, `/dice-roll`, `/loot` — `requireAuth`
- `/monsters`, `/history` — `requireAdmin`

> These must stay in sync with `routes/pages.js`. When a page is added or removed, update both `routes/pages.js` and this list.
