const router = require('express').Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/roles');
const { calculateScore } = require('../services/creditScoring');
const { logAudit } = require('../utils/audit');

router.use(authenticate);

router.get('/', requireRoles('Admin','Credit Analyst'), async (req, res, next) => {
  try {
    const { page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    const result = await query(`
      SELECT cs.*, la.application_number, la.loan_type, b.full_name, u.name as scored_by_name
      FROM credit_scores cs
      JOIN loan_applications la ON cs.application_id=la.id
      JOIN borrowers b ON cs.borrower_id=b.id
      LEFT JOIN users u ON cs.scored_by=u.id
      ORDER BY cs.scored_at DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);
    const countRes = await query('SELECT COUNT(*) FROM credit_scores');
    res.json({ scores: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) { next(err); }
});

router.post('/score/:applicationId', requireRoles('Admin','Credit Analyst'), async (req, res, next) => {
  try {
    const { cibil_score, notes } = req.body;
    const appRes = await query('SELECT * FROM loan_applications WHERE id=$1', [req.params.applicationId]);
    if (!appRes.rows[0]) return res.status(404).json({ error: 'Application not found' });
    const app = appRes.rows[0];

    if (app.status !== 'Credit Check') {
      return res.status(400).json({ error: 'Application must be in Credit Check status' });
    }
    if (!cibil_score) return res.status(400).json({ error: 'cibil_score required' });

    const scoreData = calculateScore({
      cibilScore: parseInt(cibil_score),
      monthlyIncome: parseFloat(app.monthly_income || 0),
      monthlyExpenses: parseFloat(app.monthly_expenses || 0),
      existingEmi: parseFloat(app.existing_emi || 0),
      loanAmount: parseFloat(app.loan_amount),
      tenureMonths: parseInt(app.tenure_months),
      employmentType: app.employment_type,
      interestRate: parseFloat(app.interest_rate || 12),
    });

    const existing = await query('SELECT id FROM credit_scores WHERE application_id=$1', [app.id]);
    let scoreResult;
    if (existing.rows[0]) {
      scoreResult = await query(
        `UPDATE credit_scores SET cibil_score=$1,dti_ratio=$2,employment_score=$3,income_score=$4,
         cibil_score_points=$5,dti_score_points=$6,total_score=$7,risk_band=$8,recommendation=$9,
         scored_by=$10,scored_at=NOW(),notes=$11 WHERE application_id=$12 RETURNING *`,
        [scoreData.cibilScore, scoreData.dtiRatio, scoreData.employmentScore, scoreData.incomeScore,
         scoreData.cibilScorePoints, scoreData.dtiScorePoints, scoreData.totalScore,
         scoreData.riskBand, scoreData.recommendation, req.user.id, notes, app.id]
      );
    } else {
      scoreResult = await query(
        `INSERT INTO credit_scores (application_id,borrower_id,cibil_score,dti_ratio,employment_score,income_score,
         cibil_score_points,dti_score_points,total_score,risk_band,recommendation,scored_by,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [app.id, app.borrower_id, scoreData.cibilScore, scoreData.dtiRatio, scoreData.employmentScore,
         scoreData.incomeScore, scoreData.cibilScorePoints, scoreData.dtiScorePoints, scoreData.totalScore,
         scoreData.riskBand, scoreData.recommendation, req.user.id, notes]
      );
    }

    await logAudit({ userId: req.user.id, action: 'CREDIT_SCORE', entityType: 'loan_applications', entityId: app.id, newValues: scoreData, ipAddress: req.ip });
    res.json({ score: scoreResult.rows[0], calculation: scoreData });
  } catch (err) { next(err); }
});

router.get('/application/:applicationId', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cs.*, u.name as scored_by_name FROM credit_scores cs LEFT JOIN users u ON cs.scored_by=u.id WHERE cs.application_id=$1 ORDER BY cs.scored_at DESC`,
      [req.params.applicationId]
    );
    res.json({ scores: result.rows });
  } catch (err) { next(err); }
});

module.exports = router;
