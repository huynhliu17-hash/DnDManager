# CLAUDE.md

## Project Reference

See `PROJECT_STRUCTURE.md` for the authoritative reference on this project: file map, DB schema, API routes, frontend architecture, and coding conventions.

**When looking for any project information, always grep `PROJECT_STRUCTURE.md` for the relevant section first — this takes priority over exploring the project manually.** Only read the file in full if the needed information is not found via grep. Available sections are listed at the top of the file.

**Keep `PROJECT_STRUCTURE.md` up to date whenever:**
- A route is added, removed, or its path/method/auth changes; also update `## Page Access Policy`
- A DB table or column is added, removed, or altered (including migrations)
- A new file is added or an existing file is moved/deleted (including `public/js/` utilities)
- A frontend JS function is added, removed, renamed, moved between files, or its behavior changes significantly
- A frontend state variable is added, removed, or renamed
- A Key Element ID is added or removed (buttons/elements whose CSS class is shared across elements)
- `ALLOWED_FIELDS` in any route file changes
- Auth behavior or session logic changes, including any hardcoded bootstrap grants in `db/schema.js`

**If `PROJECT_STRUCTURE.md` and the actual code disagree, trust the code and update the doc.**

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
