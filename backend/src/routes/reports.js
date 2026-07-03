const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');

router.use(authenticate, requireRoles('Admin'));

// Dashboard summary stats
router.get('/summary', async (req, res, next) => {
  try {
    const [leads, apps, accounts, overdue, disbursed, collections] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='New') as new_leads FROM leads`),
      query(`SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status='Approved') as approved,
             COUNT(*) FILTER (WHERE status='Rejected') as rejected,
             COUNT(*) FILTER (WHERE status='Disbursed') as disbursed,
             COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as this_month
             FROM loan_applications`),
      query(`SELECT COUNT(*) as total, SUM(outstanding_balance) as total_outstanding,
             SUM(principal_amount) as total_disbursed FROM loan_accounts`),
      query(`SELECT COUNT(DISTINCT loan_account_id) as accounts,
             SUM(emi_amount - paid_amount) as amount FROM emi_schedule WHERE status='Overdue'`),
      query(`SELECT SUM(principal_amount) as amount, COUNT(*) as count,
             DATE_TRUNC('month', disbursement_date) as month
             FROM loan_accounts
             WHERE disbursement_date >= NOW() - INTERVAL '6 months'
             GROUP BY month ORDER BY month`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE outcome='PTP') as ptp FROM collections_log`),
    ]);

    res.json({
      leads: leads.rows[0],
      applications: apps.rows[0],
      accounts: accounts.rows[0],
      overdue: overdue.rows[0],
      monthlyDisbursements: disbursed.rows,
      collections: collections.rows[0],
    });
  } catch (err) { next(err); }
});

// Disbursement report
router.get('/disbursement', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let dateWhere = '';
    if (from) dateWhere += ` AND la.disbursement_date >= $${params.push(from)}`;
    if (to) dateWhere += ` AND la.disbursement_date <= $${params.push(to)}`;

    const result = await query(`
      SELECT la.account_number, la.disbursement_date, la.principal_amount, la.interest_rate,
             la.tenure_months, la.emi_amount, la.status, la.outstanding_balance,
             b.full_name, b.phone, app.loan_type, app.application_number
      FROM loan_accounts la
      JOIN borrowers b ON la.borrower_id=b.id
      JOIN loan_applications app ON la.application_id=app.id
      WHERE 1=1 ${dateWhere}
      ORDER BY la.disbursement_date DESC
    `, params);

    const summary = await query(`
      SELECT COUNT(*) as count, SUM(principal_amount) as total_disbursed,
             AVG(interest_rate) as avg_rate
      FROM loan_accounts la WHERE 1=1 ${dateWhere}
    `, params);

    res.json({ disbursements: result.rows, summary: summary.rows[0] });
  } catch (err) { next(err); }
});

// Collection efficiency report
router.get('/collection-efficiency', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        DATE_TRUNC('month', es.due_date) as month,
        COUNT(*) as total_emis,
        COUNT(*) FILTER (WHERE es.status='Paid') as paid,
        COUNT(*) FILTER (WHERE es.status='Overdue') as overdue,
        SUM(es.emi_amount) as scheduled_amount,
        SUM(es.paid_amount) as collected_amount,
        ROUND(SUM(es.paid_amount)::numeric / NULLIF(SUM(es.emi_amount), 0) * 100, 2) as efficiency_pct
      FROM emi_schedule es
      WHERE es.due_date <= CURRENT_DATE
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);
    res.json({ report: result.rows });
  } catch (err) { next(err); }
});

// NPA tracker
router.get('/npa', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT la.account_number, la.status, la.outstanding_balance, la.disbursement_date,
             b.full_name, b.phone,
             COUNT(es.id) FILTER (WHERE es.status='Overdue') as overdue_emis,
             SUM(es.emi_amount - es.paid_amount) FILTER (WHERE es.status='Overdue') as overdue_amount,
             CURRENT_DATE - MIN(es.due_date) FILTER (WHERE es.status='Overdue') as dpd
      FROM loan_accounts la
      JOIN borrowers b ON la.borrower_id=b.id
      LEFT JOIN emi_schedule es ON es.loan_account_id=la.id
      WHERE la.status IN ('NPA','Active')
      GROUP BY la.id, b.id
      HAVING COUNT(es.id) FILTER (WHERE es.status='Overdue') > 0
      ORDER BY dpd DESC NULLS LAST
    `);

    const totals = await query(`
      SELECT COUNT(DISTINCT la.id) as npa_count, SUM(la.outstanding_balance) as npa_outstanding
      FROM loan_accounts la WHERE la.status='NPA'
    `);

    res.json({ npaAccounts: result.rows, totals: totals.rows[0] });
  } catch (err) { next(err); }
});

// Application funnel
router.get('/funnel', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT status, COUNT(*) as count, SUM(loan_amount) as total_amount
      FROM loan_applications
      GROUP BY status
      ORDER BY ARRAY_POSITION(ARRAY['Draft','Submitted','Under Review','Credit Check','Approved','Rejected','Disbursed'], status)
    `);
    res.json({ funnel: result.rows });
  } catch (err) { next(err); }
});

// Audit log
router.get('/audit', async (req, res, next) => {
  try {
    const { page=1, limit=50 } = req.query;
    const offset = (page-1)*limit;
    const result = await query(`
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_log al LEFT JOIN users u ON al.user_id=u.id
      ORDER BY al.created_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    const count = await query('SELECT COUNT(*) FROM audit_log');
    res.json({ logs: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) { next(err); }
});

module.exports = router;
