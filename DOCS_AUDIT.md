# Documentation Audit: PROJECT_STRUCTURE.md & CLAUDE.md

**Date:** 2026-05-18  
**Method:** 28 reads across all source files, cross-referenced against both docs

---

## Summary

| Area | Accuracy |
|------|----------|
| Route paths / HTTP methods | ✅ ~100% correct |
| DB column names & types | ✅ ~95% correct |
| Auth / session behavior | ✅ 100% correct |
| API response shapes | ✅ ~95% correct |
| Backend implementation details | ⚠️ Some gaps (dice RNG) |
| Frontend: `character-sheet.js` | ⚠️ ~25% coverage |
| Frontend: `monsters.js` | ❌ Not documented |
| Frontend: `dice-roll.js` | ❌ Not documented |
| CLAUDE.md rules | ✅ Fully enforced in code |

The backend docs are highly reliable. The frontend docs are the weakest area — `monsters.js` and `dice-roll.js` have no coverage at all, and `character-sheet.js` documents 6 of ~40 functions and 3 of ~11 state variables.

---

## Inaccuracies

### 1. `users` table schema shows `is_admin` as if it's always present
**Docs say:** `is_admin INTEGER NOT NULL DEFAULT 0` listed in the `users` schema table  
**Reality:** The initial `CREATE TABLE users` in `db/schema.js:3-9` does NOT include `is_admin`. It's added via a migration check at line 111-113. The docs don't distinguish initial schema from migration-added columns.  
**Impact:** Low — the final state is correct. But a developer reading the schema might not realize a fresh DB starts without that column and gets it added on first startup.

### 2. `spell_slots` "indexed 1–9" is misleading
**Docs say:** `JSON: 9 items [{pips:[bool×4]}] indexed 1–9`  
**Reality:** The array is 0-indexed (`spellSlots[0]` = level 1 slots). "Indexed 1–9" refers to spell *levels*, not array indices. The code (`character-sheet.js:110`, `renderSpellSlots:407`) uses `level - 1` to convert.  
**Impact:** Low, but could confuse someone writing code that iterates `spellSlots`.

### 3. `character_sheets` schema shows `spell_slots` inline
**Docs say:** `spell_slots TEXT DEFAULT '[]'` in the character_sheets table with note "added via migration"  
**Reality:** `spell_slots` is NOT in the initial `CREATE TABLE character_sheets` (`db/schema.js:12-83`). It's added by the migration block at line 89-91. The word "added via migration" is correct, but visually the table reads as if it's a first-class column.  
**Impact:** Same as #1 — final state is accurate, initial state is misleading.

---

## Gaps — Backend

### 4. Dice RNG implementation is completely undocumented
**What exists:** `routes/dice.js` uses a custom **Squirrel noise** hash-based RNG (lines 9-24) seeded from `crypto.randomBytes(4)` XOR-ed with `process.hrtime.bigint()`. This is a deliberate architectural choice replacing `Math.random()`.  
**What's documented:** Nothing about the implementation; just "POST /api/dice/roll · roll dice."  
**Suggestion:** Add a note under the Dice route or a `## Implementation Notes` section:
```
Dice are rolled with Squirrel noise (hash-based PRNG, routes/dice.js:16-24),
seeded per-batch from OS entropy + nanosecond time. Not Math.random().
```

### 5. `crypto` module dependency not noted
`routes/dice.js` imports Node's built-in `crypto`. Minor, but the Stack entry says "Node.js (CommonJS) · Express 5 · better-sqlite3 · express-session + bcryptjs" — `crypto` could be listed since its use is non-obvious.

### 6. `/api/me` skips `requireAuth` middleware
**Docs say:** No explicit note on this  
**Reality:** `/api/me` does a manual `if (!req.session.userId)` check and returns 401 JSON. Every other protected route uses `requireAuth` (which redirects to `/login.html`). This is intentional (API route shouldn't redirect), but undocumented.  
**Suggestion:** Add to Auth Model section:
```
/api/me does a manual check (returns 401 JSON) rather than requireAuth (which would redirect)
```

### 7. `GET /api/players/:userId/characters` returns fewer columns than `/api/characters`
**Docs say:** Route listed but columns not specified  
**Reality:** `party.js:14` selects `id, character_name, class_level, race` (no `updated_at`), while the equivalent `/api/characters` route selects 5 columns including `updated_at`.  
**Suggestion:** Add column list to the Party API table.

---

## Gaps — Frontend

This is the most significant gap. The `## Frontend` section only covers `character-sheet.js`, and only partially.

### 8. `monsters.js` has no documentation at all
`public/js/monsters.js` implements:
- State: `currentId`, `saveTimer`, `monsterAttacks`
- Functions: `loadMonsterList`, `createNewMonster`, `loadMonster`, `populateForm`, `deleteMonster`, `deleteCurrentMonster`, `deleteAllMonsters`, `scheduleSave` (1200ms debounce), `saveMonster`, `updateHpBar`, `renderAttacks`, `addAttack`, `removeAttack`, `toggleSidebar`
- Notable: `deleteAllMonsters()` calls `DELETE /api/monsters` (delete-all endpoint); `updateHpBar()` colors the bar green/yellow/red based on HP percentage

### 9. `dice-roll.js` has no documentation at all
`public/js/dice-roll.js` implements:
- State: `selectedType` (default `'d20'`), `diceCount` (default `1`)
- Functions: `adjustCount`, `syncCountButtons`, `rollDice`, `showResult`, `loadHistory`, `renderHistory`, `timeAgo`, `logout`
- Notable: `timeAgo()` is a **utility function defined locally** (not in `utils.js`), formats relative timestamps. This is a good candidate for moving to `utils.js`.

### 10. `character-sheet.js` Key Functions section documents 6 of ~40 functions
Functions that exist but aren't documented:

| Group | Undocumented functions |
|-------|----------------------|
| UI | `toggleSidebar`, `closeSidebar`, `toggleLore` |
| Calc | `mod`, `fmtMod`, `getAbilityScores` |
| State | `loadCharList`, `createNewCharacter`, `loadCharacter`, `updateCharList`, `setStatus`, `scheduleSave`, `saveCharacter`, `deleteCharacter` |
| Render | `bindDragRow`, `renderAttacks`, `addAttack`, `removeAttack`, `renderSpells`, `addSpell`, `removeSpell`, `renderSpellSlots`, `toggleSpellSlot` |
| Popup | `openSpellPopup`, `closeSpellPopup`, `onSpellDescOverlayClick` |
| Search | `closeSearchModal`, `onSearchOverlayClick`, `addCustomEntry`, `onDndSearchInput`, `runDndSearch`, `renderDndResults`, `selectDndItem`, `weaponAbilityMod`, `weaponBonus`, `weaponDamage` |
| Steppers | `stepNum`, `initNumSteppers` |

The file itself has an **accurate function index comment at the top** (lines 1-14) — the docs could simply reference or mirror that.

### 11. `character-sheet.js` State section documents 3 of ~11 variables
**Documented:** `currentUser`, `currentId`, `isReadOnly`  
**Undocumented:** `saveTimer`, `attacks`, `spells`, `spellSlots`, `searchContext`, `searchDebounce`, `_weaponListCache`, `_weaponDetailCache`, `_dragSrcIdx`, `spellPopupIdx`

### 12. Drag-to-reorder feature is undocumented
`character-sheet.js` supports drag-to-reorder for both attacks and spells tables via `bindDragRow()`. There's no mention of this anywhere in the docs.

### 13. Double `/api/me` fetch in `character-sheet.js`
The file calls `fetch('/api/me')` twice — once top-level at line 35 (sets `currentUser`, shows admin nav, calls `loadCharList`) and again inside `DOMContentLoaded` at line 833 (only updates `nav-username`). This is a redundancy not mentioned in docs. The second call is partly dead work.

---

## Suggestions for Improving PROJECT_STRUCTURE.md

1. **Add a `## Frontend Modules` section** covering `monsters.js` and `dice-roll.js` the same way `character-sheet.js` is covered (state vars, key functions).

2. **Expand the character-sheet.js Key Functions table** — at minimum add `loadCharList`, `saveCharacter`, `createNewCharacter`, `renderSpellSlots`, `deleteCharacter`, `bindDragRow`. The file's own index comment (line 1-14) is accurate and could be the basis.

3. **Mark migration-added columns clearly** in the DB Schema tables, e.g. `spell_slots` and `is_admin` with a note like `*(migration)*` rather than mixing them into the base table layout without distinction.

4. **Fix "indexed 1–9" → "levels 1–9 (array index 0–8)"** in the `spell_slots` schema note.

5. **Add a note to the Dice route** about the Squirrel noise RNG and crypto seeding.

6. **Note `timeAgo()` as a candidate for `utils.js`** to keep shared helpers centralized (currently it's local to `dice-roll.js`).

7. **Add column lists to Party API routes**, at minimum for `GET /api/players/:userId/characters` since it diverges from the analogous characters route.

---

## Effort Assessment

Running 28 targeted file reads + searches took approximately:
- Backend validation: easy — routes, schema, middleware all match docs closely. Spot-checking any backend feature takes 1-2 reads and docs are a reliable guide.
- Frontend validation: hard — the docs give almost no coverage of `monsters.js` / `dice-roll.js`, and only partial coverage of `character-sheet.js`. Adding any feature to these modules requires reading the source directly regardless of what the docs say.

**Overall:** The docs are production-quality for backend work and adequate-but-incomplete for frontend. Addressing items 8-11 above would bring frontend coverage to roughly the same quality as backend.
