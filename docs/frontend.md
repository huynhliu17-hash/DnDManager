# Frontend

> **Update this file** when a state variable is added, removed, or renamed, or when a notable non-obvious implementation detail changes. Function lists live in each JS file's function index comment at the top — update those in the code, not here.

## character-sheet.js (`public/js/character-sheet.js`)

> Function index: `public/js/character-sheet.js:1-14` — kept current in code.

### State
| var | description |
|-----|-------------|
| `currentUser` | `{username, guest, admin}` from `/api/me` |
| `currentId` | active character id (`null` = party view / none) |
| `isReadOnly` | true when viewing another player's char |
| `saveTimer` | debounce handle for auto-save (1200ms) |
| `attacks` | in-memory array `[{name,bonus,damage}]` for current sheet |
| `spells` | in-memory array `[{name,level,notes,description,custom}]` for current sheet |
| `spellSlots` | 9-element array `[{pips:[bool×4]}]`; index 0 = spell level 1 |
| `searchContext` | `'attack'` or `'spell'`; controls which results flow from the search modal |
| `searchDebounce` | debounce handle for D&D API search input |
| `_weaponListCache` | cached weapon list from dnd5eapi.co (fetched once per session) |
| `_weaponDetailCache` | cached weapon detail objects keyed by index |
| `_dragSrcIdx` | drag-source row index during drag-to-reorder operations |
| `spellPopupIdx` | index of the spell currently open in the description popup (`null` = closed) |

### Data Attribute Conventions
- `data-field="fieldName"` — main sheet inputs; triggers `recalc()` + `scheduleSave()`
- `data-death="success|fail"` + `data-idx` — death save checkboxes

### Notable Implementation Details
- Drag-to-reorder: `bindDragRow(tbody, arr)` handles both attacks and spells tables via `data-drag-type`
- Auth + initial data load in top-level fetch (before `DOMContentLoaded`): sets `currentUser`, shows admin nav, calls `loadCharList`; `loadPlayers` runs in `DOMContentLoaded`

---

## monsters.js (`public/js/monsters.js`)

> Function index: `public/js/monsters.js:1-9` — kept current in code.

### State
| var | description |
|-----|-------------|
| `currentId` | id of the currently displayed monster (`null` = none) |
| `saveTimer` | debounce handle for auto-save (1200ms) |
| `monsterAttacks` | in-memory array `[{name,bonus,damage}]` for current monster |

---

## dice-roll.js (`public/js/dice-roll.js`)

> Function index: `public/js/dice-roll.js:1-5` — kept current in code.

### State
| var | description |
|-----|-------------|
| `selectedType` | active dice type string, e.g. `'d20'`; default `'d20'` |
| `diceCount` | number of dice to roll; default `1`, clamped 1–20 |
| `cachedRolls` | all-users roll history array, cached between filter changes to avoid re-fetching |
| `activeFilter` | username string for the active filter chip, or `null` |

---

## loot.js (`public/js/loot.js`)

> Function index: `public/js/loot.js:1-9` — kept current in code.

### State
| var | description |
|-----|-------------|
| `items` | in-memory array of all loot item rows |
| `notesOpenId` | id of the item whose notes popup is open (`null` = closed) |
| `moneyTimer` | debounce handle for money auto-save (800ms) |
| `itemTimers` | map of `id → debounce handle` for per-item auto-save (800ms) |
| `searchQuery` | current text in the search bar (filters by item name) |
| `filterTag` | current tag filter value (`''` = all tags) |
| `sortCol` | active sort column key (`null` = no sort) |
| `sortDir` | `'desc'` or `'asc'`; `null` when `sortCol` is null |
| `COIN_TO_CP` | constant — conversion table: `{cp:1, sp:10, ep:50, gp:100, pp:1000}` |
| `COIN_ORDER` | constant — canonical deduction order: `['cp','sp','ep','gp','pp']` |
| `TAGS` | constant — valid tag values including `''` for "all" |

---

## history.js (`public/js/history.js`)

> Function index: `public/js/history.js:1-5` — kept current in code.

No persistent state variables; page fetches on load and re-fetches on manual refresh.
