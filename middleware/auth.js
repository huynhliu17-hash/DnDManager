function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login.html');
  if (req.session.isAdmin) return next();
  res.status(403).json({ error: 'Admin access required' });
}

module.exports = { requireAuth, requireAdmin };
