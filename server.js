const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'dnd-manager-secret-key-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use('/api', require('./routes/auth'));
app.use('/api/characters', require('./routes/characters'));
app.use('/api/monsters', require('./routes/monsters'));
app.use('/api/players', require('./routes/party'));
app.use('/api/dice', require('./routes/dice'));
app.use('/api/loot', require('./routes/loot'));
app.use('/', require('./routes/pages'));

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`DnD Manager running at http://localhost:${PORT}`);
  console.log(`Others on your network can connect via your local IP on port ${PORT}`);
  console.log('Server is live while this terminal is open. Close this terminal or press Ctrl+C to stop.');
});

function shutdown(reason) {
  console.log(`\n${reason} — shutting down server...`);
  server.close(() => {
    console.log('Server stopped. No connections accepted.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => shutdown('Terminal interrupted (Ctrl+C)'));
process.on('SIGTERM', () => shutdown('Process terminated'));
process.stdin.resume();
process.stdin.on('close', () => shutdown('Terminal closed'));
