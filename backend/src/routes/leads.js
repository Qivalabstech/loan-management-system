const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { logAudit } = require('../utils/audit');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, assigned_to, search } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) { conditions.push(`l.status=$${params.push(status)}`); }
    if (assigned_to) { conditions.push(`l.assigned_to=$${params.push(assigned_to)}`); }
    if (search) { conditions.push(`(l.name ILIKE $${params.push('%' + search + '%')} OR l.phone ILIKE $${params.length} OR l.email ILIKE $${params.length})`); }

    if (req.user.role === 'Loan Officer') {
      conditions.push(`l.assigned_to=$${params.push(req.user.id)}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM leads l ${where}`, params);
    const leadsRes = await query(`
      SELECT l.*, u.name as assigned_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(parseInt(offset))}
    `, params);

    res.json({ leads: leadsRes.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

router.post('/', requireRoles('Admin', 'Loan Officer'), async (req, res, next) => {
  try {
    const { name, email, phone, loan_type, loan_amount, source, assigned_to, notes } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

    const result = await query(
      `INSERT INTO leads (name, email, phone, loan_type, loan_amount, source, assigned_to, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, email, phone, loan_type, loan_amount, source || 'Website', assigned_to || req.user.id, notes]
    );
    await logAudit({ userId: req.user.id, action: 'CREATE_LEAD', entityType: 'leads', entityId: result.rows[0].id, newValues: result.rows[0], ipAddress: req.ip });
    res.status(201).json({ lead: result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT l.*, u.name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE l.id=$1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead: result.rows[0] });
  } catch (err) { next(err); }
});

router.put('/:id', requireRoles('Admin', 'Loan Officer'), async (req, res, next) => {
  try {
    const { name, email, phone, loan_type, loan_amount, source, status, assigned_to, notes } = req.body;
    const old = await query('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Lead not found' });

    const result = await query(
      `UPDATE leads SET name=$1,email=$2,phone=$3,loan_type=$4,loan_amount=$5,source=$6,status=$7,assigned_to=$8,notes=$9,updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, email, phone, loan_type, loan_amount, source, status, assigned_to, notes, req.params.id]
    );
    await logAudit({ userId: req.user.id, action: 'UPDATE_LEAD', entityType: 'leads', entityId: result.rows[0].id, oldValues: old.rows[0], newValues: result.rows[0], ipAddress: req.ip });
    res.json({ lead: result.rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRoles('Admin'), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM leads WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json({ message: 'Lead deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
