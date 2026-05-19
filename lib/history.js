const db = require('../db');

const insertHistory = db.prepare(`
  INSERT INTO loot_history (user_id, username, action, item_id, item_name, field, old_val, new_val, source)
  VALUES (@user_id, @username, @action, @item_id, @item_name, @field, @old_val, @new_val, @source)
`);

function logHistory(userId, username, action, opts = {}) {
  insertHistory.run({
    user_id: String(userId),
    username,
    action,
    item_id: opts.item_id ?? null,
    item_name: opts.item_name ?? null,
    field: opts.field ?? null,
    old_val: opts.old_val ?? null,
    new_val: opts.new_val ?? null,
    source: opts.source ?? 'loot',
  });
}

module.exports = { logHistory };
