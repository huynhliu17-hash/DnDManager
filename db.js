const Database = require('better-sqlite3');
const path = require('path');
const initSchema = require('./db/schema');

const db = new Database(path.join(__dirname, 'data.db'));
initSchema(db);

module.exports = db;
