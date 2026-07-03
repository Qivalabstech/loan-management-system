const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { logAudit } = require('../utils/audit');

router.use(authenticate);

// Overdue accounts dashboard
router.get('/overdue', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT la.*, b.full_name, b.phone, b.email as borrower_email,
             app.loan_type,
             COUNT(es.id) FILTER (WHERE es.status='Overdue') as overdue_emis,
             SUM(es.emi_amount - es.paid_amount) FILTER (WHERE es.status='Overdue') as overdue_amount,
             MIN(es.due_date) FILTER (WHERE es.status='Overdue') as oldest_due_date,
             CURRENT_DATE - MIN(es.due_date) FILTER (WHERE es.status='Overdue') as dpd
      FROM loan_accounts la
      JOIN borrowers b ON la.borrower_id=b.id
      JOIN loan_applications app ON la.application_id=app.id
      LEFT JOIN emi_schedule es ON es.loan_account_id=la.id
      WHERE la.status IN ('Active','NPA')
      GROUP BY la.id, b.id, app.id
      HAVING COUNT(es.id) FILTER (WHERE es.status='Overdue') > 0
      ORDER BY dpd DESC NULLS LAST
    `);
    res.json({ overdueAccounts: result.rows });
  } catch (err) { next(err); }
});

// Collections log list
router.get('/', requireRoles('Admin','Collections Agent'), async (req, res, next) => {
  try {
    const { loan_account_id, page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    const conditions = [];
    const params = [];
    if (loan_account_id) conditions.push(`cl.loan_account_id=$${params.push(loan_account_id)}`);
    if (req.user.role === 'Collections Agent') conditions.push(`cl.agent_id=$${params.push(req.user.id)}`);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT cl.*, la.account_number, b.full_name, u.name as agent_name
      FROM collections_log cl
      JOIN loan_accounts la ON cl.loan_account_id=la.id
      JOIN borrowers b ON cl.borrower_id=b.id
      LEFT JOIN users u ON cl.agent_id=u.id
      ${where}
      ORDER BY cl.contacted_at DESC
      LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(parseInt(offset))}
    `, params);

    const countRes = await query(`SELECT COUNT(*) FROM collections_log cl ${where}`, params.slice(0,-2));
    res.json({ logs: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) { next(err); }
});

router.post('/', requireRoles('Admin','Collections Agent'), async (req, res, next) => {
  try {
    const { loan_account_id, contact_type, outcome, ptp_date, ptp_amount, notes } = req.body;
    if (!loan_account_id || !contact_type || !outcome) {
      return res.status(400).json({ error: 'loan_account_id, contact_type, outcome required' });
    }

    const accRes = await query('SELECT la.*, b.id as bid FROM loan_accounts la JOIN borrowers b ON la.borrower_id=b.id WHERE la.id=$1', [loan_account_id]);
    if (!accRes.rows[0]) return res.status(404).json({ error: 'Loan account not found' });
    const acc = accRes.rows[0];

    // Calculate DPD
    const dpdRes = await query(
      `SELECT CURRENT_DATE - MIN(due_date) as dpd FROM emi_schedule WHERE loan_account_id=$1 AND status='Overdue'`,
      [loan_account_id]
    );
    const dpd = dpdRes.rows[0]?.dpd || 0;

    const result = await query(
      `INSERT INTO collections_log (loan_account_id,borrower_id,agent_id,contact_type,outcome,ptp_date,ptp_amount,dpd_at_contact,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [loan_account_id, acc.bid, req.user.id, contact_type, outcome, ptp_date || null, ptp_amount || null, dpd, notes]
    );

    // If DPD > 90, mark as NPA
    if (dpd > 90 && acc.status === 'Active') {
      await query('UPDATE loan_accounts SET status=\'NPA\', updated_at=NOW() WHERE id=$1', [loan_account_id]);
    }

    await logAudit({ userId: req.user.id, action: 'COLLECTIONS_CONTACT', entityType: 'loan_accounts', entityId: loan_account_id, newValues: { contact_type, outcome, dpd }, ipAddress: req.ip });
    res.status(201).json({ log: result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/account/:accountId', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cl.*, u.name as agent_name FROM collections_log cl LEFT JOIN users u ON cl.agent_id=u.id
       WHERE cl.loan_account_id=$1 ORDER BY cl.contacted_at DESC`,
      [req.params.accountId]
    );
    res.json({ logs: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
