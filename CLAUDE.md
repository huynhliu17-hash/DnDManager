# CLAUDE.md

## Project Reference

See `docs/` for the authoritative project reference, organized by domain:

| Domain | File | Contents |
|--------|------|----------|
| Stack & Files | `docs/stack-files.md` | tech stack, file map, key element IDs, conventions |
| DB Schema | `docs/schema.md` | tables, columns, migration notes |
| API Routes | `docs/routes.md` | routes, methods, auth, ordering constraints |
| Auth Model | `docs/auth.md` | session model, middleware, page access policy |
| Frontend | `docs/frontend.md` | state variables, data attributes, notable details |

**When looking for any project information, grep `docs/` for the relevant domain file first.** `PROJECT_STRUCTURE.md` is the index — start there if unsure which file to grep.

**Keep domain docs up to date:**

| When you change… | Update… |
|-----------------|---------|
| A route's path, method, or auth | `docs/routes.md`; if page access level changes, also `docs/auth.md` + `## Page Access Policy` below |
| A DB table or column (incl. migrations) | `docs/schema.md` |
| A file added, moved, or deleted | `docs/stack-files.md` File Map |
| A Key Element ID added or removed | `docs/stack-files.md` Key Element IDs |
| `ALLOWED_FIELDS` in any route | `docs/routes.md` notes for that route |
| Auth behavior, session logic, or bootstrap grants in `db/schema.js` | `docs/auth.md` |
| A frontend state variable added, removed, or renamed | `docs/frontend.md` for that JS file |
| A frontend function added, removed, or renamed | Update the function index comment at the top of the JS file |

**If a domain doc and the actual code disagree, trust the code and update the doc.**

## Page Access Policy

Every route that serves a page **must** use exactly one of these two middlewares — no exceptions:

- `requireAuth` — accessible to any logged-in user (including guests)
- `requireAdmin` — accessible only to users with `is_admin = 1`

**No new page may be added without explicitly choosing one of these.** Default to `requireAdmin` when in doubt; switch to `requireAuth` only when the page is intentionally public to all users.

All pages that existed before this rule was added use `requireAuth` (accessible to everyone).

Always import auth middleware with destructuring: `const { requireAuth, requireAdmin } = require('../middleware/auth');`

## Git Commit Policy

- **Never** include `Co-Authored-By: Claude` or any similar AI attribution line in commit messages.
- **Never** include `Co-Authored-By: Anthropic` or any tool/model name in commit messages.
- Commit messages must be written as if authored solely by the developer.
