const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { logAudit } = require('../utils/audit');
const { notify } = require('../services/notifications');

router.use(authenticate);

const STATUS_FLOW = ['Draft','Submitted','Under Review','Credit Check','Approved','Rejected','Disbursed'];

function nextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}

function generateAppNumber() {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `APP-${ym}-${rand}`;
}

// List borrowers (for application form)
router.get('/borrowers', async (req, res, next) => {
  try {
    const { search } = req.query;
    const params = [];
    let where = '';
    if (search) {
      where = `WHERE full_name ILIKE $${params.push('%' + search + '%')} OR phone ILIKE $${params.length} OR pan_number ILIKE $${params.length}`;
    }
    const result = await query(`SELECT * FROM borrowers ${where} ORDER BY full_name LIMIT 50`, params);
    res.json({ borrowers: result.rows });
  } catch (err) { next(err); }
});

router.post('/borrowers', async (req, res, next) => {
  try {
    const { full_name, email, phone, dob, pan_number, aadhaar_number, address, city, state, pincode } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Full name required' });
    const result = await query(
      `INSERT INTO borrowers (full_name,email,phone,dob,pan_number,aadhaar_number,address,city,state,pincode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [full_name,email,phone,dob,pan_number,aadhaar_number,address,city,state,pincode]
    );
    res.status(201).json({ borrower: result.rows[0] });
  } catch (err) { next(err); }
});

// Applications list
router.get('/', async (req, res, next) => {
  try {
    const { page=1, limit=20, status, loan_type, search } = req.query;
    const offset = (page-1)*limit;
    const conditions = [];
    const params = [];

    if (status) conditions.push(`la.status=$${params.push(status)}`);
    if (loan_type) conditions.push(`la.loan_type=$${params.push(loan_type)}`);
    if (search) conditions.push(`(la.application_number ILIKE $${params.push('%'+search+'%')} OR b.full_name ILIKE $${params.length})`);

    if (req.user.role === 'Loan Officer') conditions.push(`la.assigned_officer=$${params.push(req.user.id)}`);

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM loan_applications la JOIN borrowers b ON la.borrower_id=b.id ${where}`, params);
    const result = await query(`
      SELECT la.*, b.full_name, b.phone, b.email as borrower_email, u.name as officer_name
      FROM loan_applications la
      JOIN borrowers b ON la.borrower_id=b.id
      LEFT JOIN users u ON la.assigned_officer=u.id
      ${where}
      ORDER BY la.created_at DESC
      LIMIT $${params.push(parseInt(limit))} OFFSET $${params.push(parseInt(offset))}
    `, params);

    res.json({ applications: result.rows, total: parseInt(countRes.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

router.post('/', requireRoles('Admin','Loan Officer'), async (req, res, next) => {
  try {
    const { borrower_id, lead_id, loan_type, loan_amount, tenure_months, interest_rate, purpose,
            employment_type, employer_name, monthly_income, monthly_expenses, existing_emi } = req.body;

    if (!borrower_id || !loan_type || !loan_amount || !tenure_months) {
      return res.status(400).json({ error: 'borrower_id, loan_type, loan_amount, tenure_months required' });
    }

    let appNum;
    let attempt = 0;
    while (attempt < 5) {
      appNum = generateAppNumber();
      const exists = await query('SELECT id FROM loan_applications WHERE application_number=$1', [appNum]);
      if (!exists.rows[0]) break;
      attempt++;
    }

    const result = await query(
      `INSERT INTO loan_applications
        (application_number,borrower_id,lead_id,assigned_officer,loan_type,loan_amount,tenure_months,
         interest_rate,purpose,employment_type,employer_name,monthly_income,monthly_expenses,existing_emi)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [appNum, borrower_id, lead_id || null, req.user.id, loan_type, loan_amount, tenure_months,
       interest_rate || 12.0, purpose, employment_type, employer_name, monthly_income, monthly_expenses, existing_emi || 0]
    );
    await logAudit({ userId: req.user.id, action: 'CREATE_APPLICATION', entityType: 'loan_applications', entityId: result.rows[0].id, newValues: result.rows[0], ipAddress: req.ip });
    res.status(201).json({ application: result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT la.*, b.full_name, b.phone, b.email as borrower_email, b.pan_number, b.aadhaar_number,
             b.dob, b.address, b.city, b.state, b.pincode, u.name as officer_name
      FROM loan_applications la
      JOIN borrowers b ON la.borrower_id=b.id
      LEFT JOIN users u ON la.assigned_officer=u.id
      WHERE la.id=$1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Application not found' });

    const docs = await query('SELECT * FROM documents WHERE application_id=$1 ORDER BY uploaded_at DESC', [req.params.id]);
    const scores = await query('SELECT * FROM credit_scores WHERE application_id=$1 ORDER BY scored_at DESC LIMIT 1', [req.params.id]);

    res.json({ application: result.rows[0], documents: docs.rows, creditScore: scores.rows[0] || null });
  } catch (err) { next(err); }
});

router.put('/:id', requireRoles('Admin','Loan Officer'), async (req, res, next) => {
  try {
    const { loan_type, loan_amount, tenure_months, interest_rate, purpose, employment_type,
            employer_name, monthly_income, monthly_expenses, existing_emi, assigned_officer } = req.body;

    const old = await query('SELECT * FROM loan_applications WHERE id=$1', [req.params.id]);
    if (!old.rows[0]) return res.status(404).json({ error: 'Application not found' });
    if (old.rows[0].status !== 'Draft') return res.status(400).json({ error: 'Can only edit Draft applications' });

    const result = await query(
      `UPDATE loan_applications SET loan_type=$1,loan_amount=$2,tenure_months=$3,interest_rate=$4,purpose=$5,
       employment_type=$6,employer_name=$7,monthly_income=$8,monthly_expenses=$9,existing_emi=$10,
       assigned_officer=$11,updated_at=NOW() WHERE id=$12 RETURNING *`,
      [loan_type, loan_amount, tenure_months, interest_rate, purpose, employment_type, employer_name,
       monthly_income, monthly_expenses, existing_emi, assigned_officer, req.params.id]
    );
    res.json({ application: result.rows[0] });
  } catch (err) { next(err); }
});

// Advance workflow status
router.post('/:id/advance', requireRoles('Admin','Loan Officer','Credit Analyst'), async (req, res, next) => {
  try {
    const { rejection_reason, approved_amount, approved_rate, approved_tenure } = req.body;
    const appRes = await query(`
      SELECT la.*, b.full_name, b.email as borrower_email
      FROM loan_applications la JOIN borrowers b ON la.borrower_id=b.id WHERE la.id=$1
    `, [req.params.id]);

    if (!appRes.rows[0]) return res.status(404).json({ error: 'Application not found' });
    const app = appRes.rows[0];

    if (app.status === 'Rejected' || app.status === 'Disbursed') {
      return res.status(400).json({ error: `Cannot advance from ${app.status}` });
    }

    const next = nextStatus(app.status);
    if (!next) return res.status(400).json({ error: 'No next status available' });

    const updates = { status: next, updated_at: 'NOW()' };
    if (next === 'Submitted') updates.submitted_at = 'NOW()';
    if (next === 'Under Review') updates.reviewed_at = 'NOW()';
    if (next === 'Approved') {
      updates.approved_at = 'NOW()';
      if (approved_amount) updates.approved_amount = approved_amount;
      if (approved_rate) updates.approved_rate = approved_rate;
      if (approved_tenure) updates.approved_tenure = approved_tenure;
    }

    const setClauses = Object.keys(updates).map((k, i) =>
      k === 'updated_at' || k.endsWith('_at') ? `${k}=NOW()` : `${k}=$${i+1}`
    );
    const vals = Object.keys(updates)
      .filter(k => k !== 'updated_at' && !k.endsWith('_at'))
      .map(k => updates[k]);

    const result = await query(
      `UPDATE loan_applications SET ${setClauses.join(',')} WHERE id=$${vals.length+1} RETURNING *`,
      [...vals.filter(v => v !== 'NOW()'), req.params.id]
    );

    // Simplified advance
    const finalResult = await query(
      `UPDATE loan_applications SET status=$1, updated_at=NOW(),
       submitted_at=CASE WHEN $1='Submitted' THEN NOW() ELSE submitted_at END,
       reviewed_at=CASE WHEN $1='Under Review' THEN NOW() ELSE reviewed_at END,
       approved_at=CASE WHEN $1='Approved' THEN NOW() ELSE approved_at END,
       approved_amount=CASE WHEN $1='Approved' AND $2::numeric IS NOT NULL THEN $2 ELSE approved_amount END,
       approved_rate=CASE WHEN $1='Approved' AND $3::numeric IS NOT NULL THEN $3 ELSE approved_rate END,
       approved_tenure=CASE WHEN $1='Approved' AND $4::integer IS NOT NULL THEN $4 ELSE approved_tenure END
       WHERE id=$5 RETURNING *`,
      [next, approved_amount || null, approved_rate || null, approved_tenure || null, req.params.id]
    );

    await logAudit({ userId: req.user.id, action: `STATUS_${next.toUpperCase().replace(' ','_')}`, entityType: 'loan_applications', entityId: app.id, oldValues: { status: app.status }, newValues: { status: next }, ipAddress: req.ip });

    if (next === 'Submitted') await notify('submitted', app.borrower_email, app.full_name, app.application_number);
    if (next === 'Approved') await notify('approved', app.borrower_email, app.full_name, app.application_number, approved_amount || app.loan_amount);

    res.json({ application: finalResult.rows[0] });
  } catch (err) { next(err); }
});

// Reject application
router.post('/:id/reject', requireRoles('Admin','Credit Analyst'), async (req, res, next) => {
  try {
    const { rejection_reason } = req.body;
    if (!rejection_reason) return res.status(400).json({ error: 'rejection_reason required' });

    const appRes = await query(`
      SELECT la.*, b.full_name, b.email as borrower_email
      FROM loan_applications la JOIN borrowers b ON la.borrower_id=b.id WHERE la.id=$1
    `, [req.params.id]);
    if (!appRes.rows[0]) return res.status(404).json({ error: 'Application not found' });
    const app = appRes.rows[0];

    if (['Disbursed','Rejected','Draft'].includes(app.status)) {
      return res.status(400).json({ error: `Cannot reject from ${app.status}` });
    }

    const result = await query(
      `UPDATE loan_applications SET status='Rejected', rejection_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [rejection_reason, req.params.id]
    );

    await notify('rejected', app.borrower_email, app.full_name, app.application_number, rejection_reason);
    await logAudit({ userId: req.user.id, action: 'REJECT_APPLICATION', entityType: 'loan_applications', entityId: app.id, oldValues: { status: app.status }, newValues: { status: 'Rejected', rejection_reason }, ipAddress: req.ip });

    res.json({ application: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
