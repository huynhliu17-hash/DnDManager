# DB Schema

> **Update this file** whenever a table or column is added, removed, or altered — including migrations. Mark migration-added columns with `*(migration)*`. If this file and `db/schema.js` disagree, trust `db/schema.js` and update here.

## users
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| username | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT | nullable — passwordless accounts allowed |
| is_admin | INTEGER NOT NULL DEFAULT 0 | 1 = admin; new accounts always get 0; *(migration)* — not in initial CREATE TABLE |
| created_at | DATETIME | |

## monsters
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | TEXT NOT NULL | `'guest'` or `String(rowid)` |
| name | TEXT DEFAULT '' | |
| ac | INTEGER DEFAULT 10 | armor class |
| max_hp | INTEGER DEFAULT 0 | |
| current_hp | INTEGER DEFAULT 0 | |
| attacks | TEXT DEFAULT '[]' | JSON: `[{name,bonus,damage}]` |
| created_at, updated_at | DATETIME | `updated_at` set on every PUT |

## character_sheets
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | TEXT NOT NULL | `'guest'` or `String(rowid)` |
| character_name, class_level, background, player_name, race, alignment | TEXT DEFAULT '' | |
| experience_points, inspiration, proficiency_bonus | INTEGER | defaults: 0, 0, 2 |
| strength, dexterity, constitution, intelligence, wisdom, charisma | INTEGER DEFAULT 10 | |
| save_str … save_cha (6) | INTEGER DEFAULT 0 | proficiency checkbox: 0/1 |
| skill_acrobatics … skill_survival (18) | INTEGER DEFAULT 0 | proficiency checkbox: 0/1 |
| armor_class, initiative, speed | INTEGER | defaults: 10, 0, 30 |
| max_hp, current_hp, temp_hp | INTEGER DEFAULT 0 | |
| hit_dice | TEXT DEFAULT '' | e.g. `"5d10"` |
| death_save_success, death_save_fail | INTEGER DEFAULT 0 | count 0–3 |
| attacks | TEXT DEFAULT '[]' | JSON: `[{name,bonus,damage}]` |
| spells | TEXT DEFAULT '[]' | JSON: `[{name,level,notes,description,custom}]` |
| spell_slots | TEXT DEFAULT '[]' | JSON: 9 items `[{pips:[bool×4]}]` levels 1–9 (array index 0–8, use `level-1`); *(migration)* — not in initial CREATE TABLE |
| cp, sp, ep, gp, pp | INTEGER DEFAULT 0 | |
| equipment, personality_traits, ideals, bonds, flaws, features_traits | TEXT DEFAULT '' | |
| backstory, allies_organizations, additional_features, treasure | TEXT DEFAULT '' | |
| created_at, updated_at | DATETIME | `updated_at` set on every PUT |

## dice_rolls
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | TEXT NOT NULL | `'guest'` or `String(rowid)` |
| username | TEXT NOT NULL | display name at time of roll |
| dice_type | TEXT NOT NULL | `'d4'`…`'d100'` |
| dice_count | INTEGER NOT NULL | 1–20 |
| results | TEXT NOT NULL | JSON array of individual roll values |
| total | INTEGER NOT NULL | sum of results |
| rolled_at | DATETIME | |

## loot_items
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| name | TEXT DEFAULT '' | |
| tag | TEXT DEFAULT '' | Weapon/Armour/Potion/Scroll/Magic/Non-magic/Gem/Art/Currency/Misc |
| location | TEXT DEFAULT '' | where the item was found |
| value | TEXT DEFAULT '' | freeform, e.g. `"50 gp"` |
| quantity | INTEGER DEFAULT 1 | |
| notes | TEXT DEFAULT '' | freeform description; shown in info popup |
| created_at | DATETIME | |

## party_money
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK | always 1; single row |
| cp, sp, ep, gp, pp | INTEGER DEFAULT 0 | copper/silver/electrum/gold/platinum |

## loot_history
| col | type | notes |
|-----|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| user_id | TEXT NOT NULL | session user id (`'guest'` or string rowid) |
| username | TEXT NOT NULL | display name at time of action |
| action | TEXT NOT NULL | `'create'` \| `'update'` \| `'delete'` \| `'money'` |
| item_id | INTEGER | NULL for money actions |
| item_name | TEXT | snapshot of item name at time of action |
| field | TEXT | for `update`: which field changed; for `money`: which coin (cp/sp/…) |
| old_val | TEXT | previous value (NULL for create) |
| new_val | TEXT | new value (NULL for delete) |
| ts | DATETIME | UTC timestamp (SQLite CURRENT_TIMESTAMP) |
