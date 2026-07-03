const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { logAudit } = require('../utils/audit');

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    await logAudit({ userId: user.id, action: 'LOGIN', entityType: 'users', entityId: user.id, ipAddress: req.ip });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/register', authenticate, requireRoles('Admin'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });

    const exists = await query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email.toLowerCase(), hash, role]
    );
    await logAudit({ userId: req.user.id, action: 'CREATE_USER', entityType: 'users', entityId: result.rows[0].id, newValues: { name, email, role }, ipAddress: req.ip });
    res.status(201).json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/users', authenticate, requireRoles('Admin'), async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows });
  } catch (err) { next(err); }
});

router.patch('/users/:id', authenticate, requireRoles('Admin'), async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const result = await query(
      'UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, email, role, is_active',
      [is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
