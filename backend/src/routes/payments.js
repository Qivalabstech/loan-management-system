const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { notify } = require('../services/notifications');
const { logAudit } = require('../utils/audit');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { loan_account_id, page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    const conditions = [];
    const params = [];
    if (loan_account_id) conditions.push(`p.loan_account_id=$${params.push(loan_account_id)}`);
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
      SELECT p.*, la.account_number, b.full_name, u.name as recorded_by_name
      FROM payments p
      JOIN loan_accounts la ON p.loan_account_id=la.id
      JOIN borrowers b ON la.borrower_id=b.id
      LEFT JOIN users u ON p.recorded_by=u.id
      ${where}
      ORDER BY p.payment_date DESC
      LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(parseInt(offset))}
    `, params);

    const countRes = await query(`SELECT COUNT(*) FROM payments p ${where}`, params.slice(0, -2));
    res.json({ payments: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) { next(err); }
});

router.post('/', requireRoles('Admin','Loan Officer'), async (req, res, next) => {
  try {
    const { loan_account_id, emi_schedule_id, amount, payment_mode, reference_number, payment_date, notes } = req.body;
    if (!loan_account_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'loan_account_id, amount, payment_date required' });
    }

    const accRes = await query(`
      SELECT la.*, b.full_name, b.email as borrower_email FROM loan_accounts la
      JOIN borrowers b ON la.borrower_id=b.id WHERE la.id=$1
    `, [loan_account_id]);
    if (!accRes.rows[0]) return res.status(404).json({ error: 'Loan account not found' });
    const account = accRes.rows[0];

    // Record payment
    const payResult = await query(
      `INSERT INTO payments (loan_account_id,emi_schedule_id,amount,payment_mode,reference_number,payment_date,recorded_by,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [loan_account_id, emi_schedule_id || null, parseFloat(amount), payment_mode || 'NEFT',
       reference_number, payment_date, req.user.id, notes]
    );

    // Update EMI schedule if linked
    if (emi_schedule_id) {
      const emiRes = await query('SELECT * FROM emi_schedule WHERE id=$1', [emi_schedule_id]);
      if (emiRes.rows[0]) {
        const emi = emiRes.rows[0];
        const totalPaid = parseFloat(emi.paid_amount || 0) + parseFloat(amount);
        const newStatus = totalPaid >= parseFloat(emi.emi_amount) ? 'Paid' : 'Partial';
        await query(
          `UPDATE emi_schedule SET paid_amount=$1, status=$2, paid_date=$3 WHERE id=$4`,
          [totalPaid, newStatus, payment_date, emi_schedule_id]
        );
      }
    }

    // Update account outstanding balance
    const newBalance = Math.max(0, parseFloat(account.outstanding_balance) - parseFloat(amount));
    const newTotalPaid = parseFloat(account.total_paid || 0) + parseFloat(amount);
    const newStatus = newBalance <= 0 ? 'Closed' : account.status;
    await query(
      `UPDATE loan_accounts SET outstanding_balance=$1, total_paid=$2, status=$3, last_payment_date=$4, updated_at=NOW() WHERE id=$5`,
      [newBalance, newTotalPaid, newStatus, payment_date, loan_account_id]
    );

    await notify('paymentReceived', account.borrower_email, account.full_name, parseFloat(amount), account.account_number, newBalance);
    await logAudit({ userId: req.user.id, action: 'RECORD_PAYMENT', entityType: 'payments', entityId: payResult.rows[0].id, newValues: { amount, loan_account_id, payment_mode }, ipAddress: req.ip });

    res.status(201).json({ payment: payResult.rows[0], newBalance });
  } catch (err) { next(err); }
});

module.exports = router;
