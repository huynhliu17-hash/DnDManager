# Mobile Responsiveness Plan

## Breakpoint Strategy

| Breakpoint | Label | Width |
|------------|-------|-------|
| `sm` | Small phone | < 480px |
| `md` | Large phone / small tablet | 480px – 768px |
| `lg` | Tablet | 768px – 1024px |
| `xl` | Desktop | > 1024px |

Currently the CSS has a single breakpoint at 780px and a partial one at 900px. These need to be expanded into a consistent 4-tier system.

---

## Issues by Area

### 1. Navbar
**Problem:** Brand + nav tabs + username + logout button all sit in a single horizontal row. On phones the row overflows or crushes the elements together.

**Fix:**
- Below `md`: hide the nav tabs and username text; keep only the brand and a logout button
- The nav tabs (Home / Character Sheet) can be omitted on mobile since the character sheet is the only real page — or collapsed into a hamburger/drawer if more pages are added later

---

### 2. Sidebar
**Problem:** The sidebar toggle works, but when open on mobile it pushes the sheet content to the right rather than overlaying it, potentially hiding or shrinking the sheet below usable width.

**Fix:**
- Below `md`: when open, the sidebar should be a full-screen overlay (position fixed, 100vw or close to it) with a backdrop that closes it on tap
- The existing `85vw` treatment at 780px is close but doesn't use `position: fixed`, so content behind it still shifts

---

### 3. Character Sheet Header
**Problem:** The name field + 6 sub-fields (`cs-header-sub`) are in a `flex-wrap` row. At 3 columns it wraps awkwardly on narrow screens.

**Fix:**
- `sm`: stack name field and sub-fields to a single column (1fr)
- `md`: 2-column sub-grid (current 780px rule is already this — just ensure the name field also stacks fully)

---

### 4. Main Two-Column Layout (`.cs-columns`)
**Status:** Already collapses to 1fr at 780px. No additional changes needed here — works correctly.

---

### 5. Ability Score Grid
**Problem:** 3-column grid (`repeat(3, 1fr)`) inside the left column. Once the left column goes full-width, the 3-col grid is fine on tablets but gets compact on small phones.

**Fix:**
- `sm`: switch to 2-column grid, stacking STR/DEX/CON on one side and INT/WIS/CHA on the other — matches how the D&D sheet groups them

---

### 6. Saving Throws & Skills Lists
**Status:** Single-column lists, already fine on all widths. No changes needed.

---

### 7. Combat Stats Row (`.cs-combat-top`)
**Problem:** AC, Initiative, Speed, Passive Perception are in a horizontal `flex` row. Works on tablet but cramped on small phones (each stat has a large number input + label).

**Fix:**
- `sm`: wrap to 2×2 grid instead of a single row

---

### 8. HP Grid
**Problem:** 3-column grid for Max HP / Current HP / Temp HP. Fine on tablet, borderline on small phones.

**Fix:**
- `sm`: collapse to a single row with tighter inputs, or stack to 1 column

---

### 9. Spell Slots Grid
**Problem:** 3-column grid (`repeat(3, 1fr)`) for 9 spell levels. Works on tablet; on phones each cell gets very narrow and the pip circles become hard to tap (currently 13px diameter — well below the 44px touch target recommendation).

**Fix:**
- Increase pip size to at minimum 24px diameter (ideally 32px on mobile)
- `sm/md`: switch to a single-column list layout where each spell level row shows label + pips horizontally, removing the 3-col wrapping grid

---

### 10. Touch Targets
**Problem:** Several interactive elements are far below the 44×44px minimum touch target size recommended by Apple/Google:

| Element | Current size | Issue |
|---------|-------------|-------|
| Spell slot pips | 13×13px | Too small to tap reliably |
| Step buttons (▲/▼) | 16px wide | Very narrow |
| Skill/save checkboxes | 14×14px | Below minimum |
| Delete button on char list | ~20×20px | Appears only on hover (inaccessible on touch) |
| Drag handles on attack table | 18px wide | Drag-and-drop is not touch-friendly |

**Fix:**
- All tappable elements: minimum 44×44px hit area (can use `padding` or `::after` pseudo-element trick to expand the tap zone without changing visual size)
- Spell slot pips: increase to 24px visual, 44px tap zone on mobile
- Char list delete button: always visible on mobile (hover states don't exist on touch)
- Drag-and-drop on attack/spell rows: replace with up/down arrow buttons on mobile, or disable reordering and add it back later with a touch-drag library

---

### 11. Attack & Spell Tables
**Problem:** `<table>` layout with inline inputs for Name / Bonus / Damage. Tables don't reflow — they scroll horizontally or squish columns below usability on phones.

**Fix (two options):**
- **Option A (simpler):** Allow the table to scroll horizontally (`overflow-x: auto` on a wrapper). Fast to implement, but UX is poor.
- **Option B (better):** On `sm/md`, switch each row to a card layout (stacked fields with labels). Requires a CSS restructure of the table rows or switching from `<table>` to `<div>` rows.

Recommendation: **Option B**, since attacks and spells are frequently edited during play.

---

### 12. Currency Grid
**Problem:** 5 equal columns (`repeat(5, 1fr)`) for CP / SP / EP / GP / PP. On 375px screens each column is ~60px — inputs and labels are readable but tight.

**Fix:**
- `sm`: wrap to a 3+2 layout or a single scrollable row with slightly wider cells

---

### 13. Bottom Grid (Lore, Personality, etc.)
**Status:** Already collapses to 1 column at 780px. No additional changes needed.

---

### 14. Lore Grid (`.cs-lore-grid`)
**Status:** Already handles 4 → 2 → 1 columns across breakpoints. No changes needed.

---

### 15. Font Sizes
**Problem:** Several labels use very small font sizes that become unreadable on phones:

| Class | Current size |
|-------|-------------|
| `.spell-slot-label` | 0.62rem (~10px) |
| `.cs-combat-stat label` | 0.68rem (~11px) |
| `.ability-label`, `.cs-field label` | 0.70–0.72rem (~11–12px) |

**Fix:**
- `sm/md`: floor all UI labels at `0.75rem` (12px). This is a small change with big readability impact.

---

### 16. Modals (New Character, DnD Search, Spell Description)
**Status:** All modals already have `max-width: 95vw`. Minor improvements:
- New character modal (`max-width: 1100px`): its interior uses a multi-column grid — needs the same responsive column treatment as the main sheet
- DnD search modal: largely fine already
- Spell description modal: fine already

---

### 17. Login Page
**Status:** Already centered with `max-width: 400px` and padding. Works well on mobile. No changes needed.

---

## Summary — Priority Order

| Priority | Area | Effort |
|----------|------|--------|
| 1 | Touch targets (pips, checkboxes, step buttons, delete btn) | Medium |
| 2 | Navbar overflow on small screens | Small |
| 3 | Sidebar as fixed overlay on mobile | Small |
| 4 | Attack/spell table → card layout on mobile | Medium |
| 5 | Font size floor for labels | Small |
| 6 | Spell slots grid layout on mobile | Small |
| 7 | Combat stats 2×2 on small phones | Small |
| 8 | Ability score grid 2-col on small phones | Small |
| 9 | Currency grid wrapping | Tiny |
| 10 | New character modal interior columns | Small |

Total estimated effort to address all items: **8–12 hours** of CSS and minor HTML changes. No backend changes required.
