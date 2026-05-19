module.exports = function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS character_sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      character_name TEXT DEFAULT '',
      class_level TEXT DEFAULT '',
      background TEXT DEFAULT '',
      player_name TEXT DEFAULT '',
      race TEXT DEFAULT '',
      alignment TEXT DEFAULT '',
      experience_points INTEGER DEFAULT 0,
      inspiration INTEGER DEFAULT 0,
      proficiency_bonus INTEGER DEFAULT 2,
      strength INTEGER DEFAULT 10,
      dexterity INTEGER DEFAULT 10,
      constitution INTEGER DEFAULT 10,
      intelligence INTEGER DEFAULT 10,
      wisdom INTEGER DEFAULT 10,
      charisma INTEGER DEFAULT 10,
      save_str INTEGER DEFAULT 0,
      save_dex INTEGER DEFAULT 0,
      save_con INTEGER DEFAULT 0,
      save_int INTEGER DEFAULT 0,
      save_wis INTEGER DEFAULT 0,
      save_cha INTEGER DEFAULT 0,
      skill_acrobatics INTEGER DEFAULT 0,
      skill_animal_handling INTEGER DEFAULT 0,
      skill_arcana INTEGER DEFAULT 0,
      skill_athletics INTEGER DEFAULT 0,
      skill_deception INTEGER DEFAULT 0,
      skill_history INTEGER DEFAULT 0,
      skill_insight INTEGER DEFAULT 0,
      skill_intimidation INTEGER DEFAULT 0,
      skill_investigation INTEGER DEFAULT 0,
      skill_medicine INTEGER DEFAULT 0,
      skill_nature INTEGER DEFAULT 0,
      skill_perception INTEGER DEFAULT 0,
      skill_performance INTEGER DEFAULT 0,
      skill_persuasion INTEGER DEFAULT 0,
      skill_religion INTEGER DEFAULT 0,
      skill_sleight_of_hand INTEGER DEFAULT 0,
      skill_stealth INTEGER DEFAULT 0,
      skill_survival INTEGER DEFAULT 0,
      armor_class INTEGER DEFAULT 10,
      initiative INTEGER DEFAULT 0,
      speed INTEGER DEFAULT 30,
      max_hp INTEGER DEFAULT 0,
      current_hp INTEGER DEFAULT 0,
      temp_hp INTEGER DEFAULT 0,
      hit_dice TEXT DEFAULT '',
      death_save_success INTEGER DEFAULT 0,
      death_save_fail INTEGER DEFAULT 0,
      attacks TEXT DEFAULT '[]',
      spells TEXT DEFAULT '[]',
      cp INTEGER DEFAULT 0,
      sp INTEGER DEFAULT 0,
      ep INTEGER DEFAULT 0,
      gp INTEGER DEFAULT 0,
      pp INTEGER DEFAULT 0,
      equipment TEXT DEFAULT '',
      personality_traits TEXT DEFAULT '',
      ideals TEXT DEFAULT '',
      bonds TEXT DEFAULT '',
      flaws TEXT DEFAULT '',
      features_traits TEXT DEFAULT '',
      backstory TEXT DEFAULT '',
      allies_organizations TEXT DEFAULT '',
      additional_features TEXT DEFAULT '',
      treasure TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const csColumns = db.prepare('PRAGMA table_info(character_sheets)').all().map(c => c.name);
  if (!csColumns.includes('spells')) {
    db.exec(`ALTER TABLE character_sheets ADD COLUMN spells TEXT DEFAULT '[]'`);
  }
  if (!csColumns.includes('spell_slots')) {
    db.exec(`ALTER TABLE character_sheets ADD COLUMN spell_slots TEXT DEFAULT '[]'`);
  }

  const userCols = db.prepare('PRAGMA table_info(users)').all();
  const pwCol = userCols.find(c => c.name === 'password_hash');
  if (pwCol && pwCol.notnull === 1) {
    db.exec(`
      BEGIN;
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO users SELECT * FROM users_old;
      DROP TABLE users_old;
      COMMIT;
    `);
  }

  if (!userCols.find(c => c.name === 'is_admin')) {
    db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS monsters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT DEFAULT '',
      ac INTEGER DEFAULT 10,
      max_hp INTEGER DEFAULT 0,
      current_hp INTEGER DEFAULT 0,
      attacks TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS dice_rolls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      dice_type TEXT NOT NULL,
      dice_count INTEGER NOT NULL,
      results TEXT NOT NULL,
      total INTEGER NOT NULL,
      rolled_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS loot_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT '',
      tag TEXT DEFAULT '',
      location TEXT DEFAULT '',
      value TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS party_money (
      id INTEGER PRIMARY KEY,
      cp INTEGER DEFAULT 0,
      sp INTEGER DEFAULT 0,
      ep INTEGER DEFAULT 0,
      gp INTEGER DEFAULT 0,
      pp INTEGER DEFAULT 0
    )
  `);
  db.prepare(`INSERT OR IGNORE INTO party_money (id) VALUES (1)`).run();

  db.exec(`
    CREATE TABLE IF NOT EXISTS loot_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      item_id INTEGER,
      item_name TEXT,
      field TEXT,
      old_val TEXT,
      new_val TEXT,
      source TEXT NOT NULL DEFAULT 'loot',
      ts DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const histCols = db.prepare('PRAGMA table_info(loot_history)').all().map(c => c.name);
  if (!histCols.includes('source')) {
    db.exec(`ALTER TABLE loot_history ADD COLUMN source TEXT NOT NULL DEFAULT 'loot'`);
  }

  // Grant admin to the 'ed' account (idempotent)
  db.prepare(`UPDATE users SET is_admin = 1 WHERE LOWER(username) = 'ed'`).run();
};
