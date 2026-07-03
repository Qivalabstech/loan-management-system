const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { buildAmortizationSchedule, calculateEMI } = require('../services/emiCalculator');
const { notify } = require('../services/notifications');
const { logAudit } = require('../utils/audit');

router.use(authenticate);

function generateAccNumber() {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `ACC-${ym}-${rand}`;
}

router.get('/', async (req, res, next) => {
  try {
    const { page=1, limit=20, status, search } = req.query;
    const offset = (page-1)*limit;
    const conditions = [];
    const params = [];

    if (status) conditions.push(`la.status=$${params.push(status)}`);
    if (search) conditions.push(`(la.account_number ILIKE $${params.push('%'+search+'%')} OR b.full_name ILIKE $${params.length})`);

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM loan_accounts la JOIN borrowers b ON la.borrower_id=b.id ${where}`, params);
    const result = await query(`
      SELECT la.*, b.full_name, b.phone, b.email as borrower_email,
             app.application_number, app.loan_type,
             (SELECT COUNT(*) FROM emi_schedule es WHERE es.loan_account_id=la.id AND es.status='Overdue') as overdue_count,
             (SELECT SUM(es.emi_amount - es.paid_amount) FROM emi_schedule es WHERE es.loan_account_id=la.id AND es.status='Overdue') as overdue_amount
      FROM loan_accounts la
      JOIN borrowers b ON la.borrower_id=b.id
      JOIN loan_applications app ON la.application_id=app.id
      ${where}
      ORDER BY la.created_at DESC
      LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(parseInt(offset))}
    `, params);

    res.json({ accounts: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT la.*, b.full_name, b.phone, b.email as borrower_email,
             app.application_number, app.loan_type, app.purpose
      FROM loan_accounts la
      JOIN borrowers b ON la.borrower_id=b.id
      JOIN loan_applications app ON la.application_id=app.id
      WHERE la.id=$1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Loan account not found' });

    const schedule = await query(
      'SELECT * FROM emi_schedule WHERE loan_account_id=$1 ORDER BY emi_number',
      [req.params.id]
    );
    const payments = await query(
      `SELECT p.*, u.name as recorded_by_name FROM payments p LEFT JOIN users u ON p.recorded_by=u.id
       WHERE p.loan_account_id=$1 ORDER BY p.payment_date DESC`,
      [req.params.id]
    );

    res.json({ account: result.rows[0], emiSchedule: schedule.rows, payments: payments.rows });
  } catch (err) { next(err); }
});

// Disburse: create loan account from approved application
router.post('/disburse', requireRoles('Admin'), async (req, res, next) => {
  try {
    const { application_id, disbursement_date } = req.body;
    if (!application_id) return res.status(400).json({ error: 'application_id required' });

    const appRes = await query(`
      SELECT la.*, b.full_name, b.email as borrower_email
      FROM loan_applications la JOIN borrowers b ON la.borrower_id=b.id
      WHERE la.id=$1
    `, [application_id]);
    if (!appRes.rows[0]) return res.status(404).json({ error: 'Application not found' });
    const app = appRes.rows[0];

    if (app.status !== 'Approved') return res.status(400).json({ error: 'Application must be Approved' });

    const existing = await query('SELECT id FROM loan_accounts WHERE application_id=$1', [application_id]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Loan account already exists for this application' });

    const principal = parseFloat(app.approved_amount || app.loan_amount);
    const rate = parseFloat(app.approved_rate || app.interest_rate || 12);
    const tenure = parseInt(app.approved_tenure || app.tenure_months);
    const emi = calculateEMI(principal, rate, tenure);

    const disbDate = disbursement_date || new Date().toISOString().split('T')[0];
    const firstEmiDate = new Date(disbDate);
    firstEmiDate.setMonth(firstEmiDate.getMonth() + 1);

    let accNum;
    let attempt = 0;
    while (attempt < 5) {
      accNum = generateAccNumber();
      const exists = await query('SELECT id FROM loan_accounts WHERE account_number=$1', [accNum]);
      if (!exists.rows[0]) break;
      attempt++;
    }

    const accResult = await query(
      `INSERT INTO loan_accounts
        (account_number,application_id,borrower_id,principal_amount,interest_rate,tenure_months,
         emi_amount,outstanding_balance,disbursement_date,first_emi_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [accNum, application_id, app.borrower_id, principal, rate, tenure, emi, principal,
       disbDate, firstEmiDate.toISOString().split('T')[0]]
    );
    const account = accResult.rows[0];

    // Build EMI schedule
    const { schedule } = buildAmortizationSchedule(principal, rate, tenure, firstEmiDate.toISOString().split('T')[0]);
    for (const s of schedule) {
      await query(
        `INSERT INTO emi_schedule (loan_account_id,emi_number,due_date,principal_component,interest_component,emi_amount,outstanding_after)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [account.id, s.emiNumber, s.dueDate, s.principalComponent, s.interestComponent, s.emiAmount, s.outstandingAfter]
      );
    }

    // Update application status to Disbursed
    await query(
      `UPDATE loan_applications SET status='Disbursed', disbursed_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [application_id]
    );

    await notify('disbursed', app.borrower_email, app.full_name, app.application_number, principal, accNum);
    await logAudit({ userId: req.user.id, action: 'DISBURSE_LOAN', entityType: 'loan_accounts', entityId: account.id, newValues: { account_number: accNum, principal, tenure }, ipAddress: req.ip });

    res.status(201).json({ account, scheduleCount: schedule.length });
  } catch (err) { next(err); }
});

router.patch('/:id/status', requireRoles('Admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await query(
      'UPDATE loan_accounts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Account not found' });
    res.json({ account: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
