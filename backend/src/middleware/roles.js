function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires: ${roles.join(', ')}` });
    }
    next();
  };
}

module.exports = { requireRoles };
