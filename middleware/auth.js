function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login.html');
  if (req.session.isAdmin) return next();
  res.status(403).json({ error: 'Admin access required' });
}

function requireBotOrAuth(req, res, next) {
  const key = req.headers['x-bot-api-key'];
  if (key && key === process.env.BOT_API_KEY) {
    req.session.userId = 'bot';
    req.session.username = 'Discord Bot';
    return next();
  }
  return requireAuth(req, res, next);
}

module.exports = { requireAuth, requireAdmin, requireBotOrAuth };
