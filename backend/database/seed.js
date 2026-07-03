#!/usr/bin/env node
// Seed script — run: node backend/database/seed.js
// All seed users have password: Admin123!

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding database...');

    // Users
    const passwordHash = await bcrypt.hash('Admin123!', 10);
    const usersResult = await client.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
        ('Rajesh Kumar', 'admin@lms.com', $1, 'Admin'),
        ('Priya Sharma', 'officer@lms.com', $1, 'Loan Officer'),
        ('Amit Verma', 'analyst@lms.com', $1, 'Credit Analyst'),
        ('Sunita Patel', 'collections@lms.com', $1, 'Collections Agent')
      RETURNING id, name, role
    `, [passwordHash]);
    const users = usersResult.rows;
    const adminId = users[0].id;
    const officerId = users[1].id;
    const analystId = users[2].id;
    const collectionsId = users[3].id;
    console.log('✅ Users created:', users.map(u => u.name).join(', '));

    // Borrowers
    const borrowersResult = await client.query(`
      INSERT INTO borrowers (full_name, email, phone, dob, pan_number, aadhaar_number, address, city, state, pincode) VALUES
        ('Rahul Mehta', 'rahul.mehta@email.com', '9876543210', '1988-05-14', 'ABCPM1234N', '234567890123', '12, MG Road, Koramangala', 'Bengaluru', 'Karnataka', '560034'),
        ('Neha Joshi', 'neha.joshi@email.com', '9812345678', '1992-08-22', 'DEFPJ5678M', '345678901234', '45, Linking Road, Bandra', 'Mumbai', 'Maharashtra', '400050'),
        ('Vikram Singh', 'vikram.singh@email.com', '9988776655', '1985-03-10', 'GHIPS9012K', '456789012345', '78, Civil Lines', 'Jaipur', 'Rajasthan', '302006'),
        ('Ananya Das', 'ananya.das@email.com', '9654321098', '1995-11-30', 'JKLDA3456L', '567890123456', '23, Park Street', 'Kolkata', 'West Bengal', '700016'),
        ('Suresh Reddy', 'suresh.reddy@email.com', '9765432109', '1980-07-18', 'MNOPR7890P', '678901234567', '56, Jubilee Hills', 'Hyderabad', 'Telangana', '500033')
      RETURNING id, full_name
    `);
    const borrowers = borrowersResult.rows;
    console.log('✅ Borrowers created:', borrowers.map(b => b.full_name).join(', '));

    // Leads
    await client.query(`
      INSERT INTO leads (name, email, phone, loan_type, loan_amount, source, status, assigned_to, notes) VALUES
        ('Arjun Kapoor', 'arjun@email.com', '9111222333', 'Personal', 500000, 'Website', 'New', $1, 'Interested in personal loan for home renovation'),
        ('Kavita Nair', 'kavita@email.com', '9222333444', 'Home', 3500000, 'Referral', 'Contacted', $1, 'Looking for home loan, has existing property'),
        ('Mohan Lal', 'mohan@email.com', '9333444555', 'Business', 1000000, 'Walk-in', 'Qualified', $1, 'Small business owner needs working capital'),
        ('Deepa Krishnan', 'deepa@email.com', '9444555666', 'Auto', 800000, 'Campaign', 'Converted', $1, 'Converted to application APP-202412-0001'),
        ('Raj Malhotra', 'raj@email.com', '9555666777', 'Education', 1500000, 'Social Media', 'Dropped', $1, 'Not eligible due to income criteria')
      RETURNING id
    `, [officerId]);
    console.log('✅ Leads created');

    // Helper to generate app number
    const makeAppNum = (i) => `APP-202412-${String(i).padStart(4, '0')}`;
    const makeAccNum = (i) => `ACC-202412-${String(i).padStart(4, '0')}`;

    // Loan Applications (10 in various stages)
    const apps = [
      // 1. Draft
      {
        num: makeAppNum(1), bid: borrowers[0].id, officer: officerId, type: 'Personal',
        amount: 500000, tenure: 24, rate: 14.5, purpose: 'Home renovation',
        emp: 'Salaried', employer: 'Infosys Ltd', income: 85000, expenses: 30000, emi: 5000,
        status: 'Draft'
      },
      // 2. Submitted
      {
        num: makeAppNum(2), bid: borrowers[1].id, officer: officerId, type: 'Home',
        amount: 3500000, tenure: 120, rate: 8.75, purpose: 'Purchase of flat',
        emp: 'Salaried', employer: 'HDFC Bank', income: 150000, expenses: 60000, emi: 0,
        status: 'Submitted'
      },
      // 3. Under Review
      {
        num: makeAppNum(3), bid: borrowers[2].id, officer: officerId, type: 'Business',
        amount: 1000000, tenure: 36, rate: 16.0, purpose: 'Working capital',
        emp: 'Business', employer: 'Self', income: 200000, expenses: 120000, emi: 10000,
        status: 'Under Review'
      },
      // 4. Credit Check
      {
        num: makeAppNum(4), bid: borrowers[3].id, officer: officerId, type: 'Auto',
        amount: 800000, tenure: 60, rate: 9.5, purpose: 'Purchase of car',
        emp: 'Salaried', employer: 'TCS Ltd', income: 95000, expenses: 40000, emi: 8000,
        status: 'Credit Check'
      },
      // 5. Approved
      {
        num: makeAppNum(5), bid: borrowers[4].id, officer: officerId, type: 'Education',
        amount: 1500000, tenure: 84, rate: 11.0, purpose: 'MBA abroad',
        emp: 'Self-Employed', employer: 'Freelancer', income: 120000, expenses: 50000, emi: 0,
        status: 'Approved', approvedAmount: 1400000, approvedRate: 11.0, approvedTenure: 84
      },
      // 6. Rejected
      {
        num: makeAppNum(6), bid: borrowers[0].id, officer: officerId, type: 'Personal',
        amount: 2000000, tenure: 60, rate: 15.0, purpose: 'Debt consolidation',
        emp: 'Salaried', employer: 'Startup Co', income: 45000, expenses: 38000, emi: 15000,
        status: 'Rejected', rejectionReason: 'High DTI ratio (>60%). Income insufficient to service the requested loan amount.'
      },
      // 7. Disbursed (with loan account)
      {
        num: makeAppNum(7), bid: borrowers[1].id, officer: officerId, type: 'Personal',
        amount: 300000, tenure: 12, rate: 13.0, purpose: 'Medical emergency',
        emp: 'Salaried', employer: 'MNC Corp', income: 70000, expenses: 25000, emi: 0,
        status: 'Disbursed', approvedAmount: 300000, approvedRate: 13.0, approvedTenure: 12
      },
      // 8. Disbursed (with overdue EMIs)
      {
        num: makeAppNum(8), bid: borrowers[2].id, officer: officerId, type: 'Business',
        amount: 500000, tenure: 18, rate: 15.5, purpose: 'Equipment purchase',
        emp: 'Business', employer: 'Singh Enterprises', income: 130000, expenses: 80000, emi: 5000,
        status: 'Disbursed', approvedAmount: 500000, approvedRate: 15.5, approvedTenure: 18
      },
      // 9. Disbursed (Active, on track)
      {
        num: makeAppNum(9), bid: borrowers[3].id, officer: officerId, type: 'Home',
        amount: 2500000, tenure: 180, rate: 8.5, purpose: 'Home purchase',
        emp: 'Salaried', employer: 'Wipro Ltd', income: 200000, expenses: 70000, emi: 0,
        status: 'Disbursed', approvedAmount: 2500000, approvedRate: 8.5, approvedTenure: 180
      },
      // 10. Under Review
      {
        num: makeAppNum(10), bid: borrowers[4].id, officer: officerId, type: 'Gold',
        amount: 250000, tenure: 12, rate: 12.0, purpose: 'Emergency funds',
        emp: 'Retired', employer: 'Retired', income: 45000, expenses: 20000, emi: 0,
        status: 'Under Review'
      },
    ];

    const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
    const NOT_DRAFT = ['Submitted','Under Review','Credit Check','Approved','Rejected','Disbursed'];
    const REVIEWED  = ['Under Review','Credit Check','Approved','Rejected','Disbursed'];
    const APPROVED  = ['Approved','Disbursed'];

    const appIds = [];
    for (const app of apps) {
      const submittedAt  = NOT_DRAFT.includes(app.status) ? daysAgo(10) : null;
      const reviewedAt   = REVIEWED.includes(app.status)  ? daysAgo(7)  : null;
      const approvedAt   = APPROVED.includes(app.status)  ? daysAgo(3)  : null;
      const disbursedAt  = app.status === 'Disbursed'     ? daysAgo(1)  : null;

      const res = await client.query(`
        INSERT INTO loan_applications
          (application_number, borrower_id, assigned_officer, loan_type, loan_amount, tenure_months,
           interest_rate, purpose, employment_type, employer_name, monthly_income, monthly_expenses,
           existing_emi, status, rejection_reason, approved_amount, approved_rate, approved_tenure,
           submitted_at, reviewed_at, approved_at, disbursed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING id
      `, [
        app.num, app.bid, app.officer, app.type, app.amount, app.tenure,
        app.rate, app.purpose, app.emp, app.employer, app.income, app.expenses,
        app.emi, app.status, app.rejectionReason || null,
        app.approvedAmount || null, app.approvedRate || null, app.approvedTenure || null,
        submittedAt, reviewedAt, approvedAt, disbursedAt
      ]);
      appIds.push(res.rows[0].id);
    }
    console.log('✅ Loan applications created');

    // Credit scores for apps in Credit Check / Approved / Disbursed stages (indices 3,4,6,7,8)
    const creditData = [
      { idx: 3, cibil: 720, dti: 35.5, emp_score: 15, inc_score: 18 },
      { idx: 4, cibil: 760, dti: 22.0, emp_score: 15, inc_score: 22 },
      { idx: 6, cibil: 680, dti: 55.0, emp_score: 15, inc_score: 12 },
      { idx: 7, cibil: 740, dti: 28.0, emp_score: 15, inc_score: 18 },
      { idx: 8, cibil: 690, dti: 42.0, emp_score: 12, inc_score: 15 },
    ];

    for (const cd of creditData) {
      const app = apps[cd.idx];
      let cibilPts = cd.cibil >= 750 ? 30 : cd.cibil >= 700 ? 22 : cd.cibil >= 650 ? 15 : 5;
      let dtiPts = cd.dti < 30 ? 25 : cd.dti < 40 ? 18 : cd.dti < 50 ? 10 : 3;
      const total = cibilPts + dtiPts + cd.emp_score + cd.inc_score;
      const risk = total >= 80 ? 'Low' : total >= 60 ? 'Medium' : total >= 40 ? 'High' : 'Very High';
      const rec = total >= 80 ? 'Approve' : total >= 40 ? 'Manual Review' : 'Decline';

      await client.query(`
        INSERT INTO credit_scores
          (application_id, borrower_id, cibil_score, dti_ratio, employment_score, income_score,
           cibil_score_points, dti_score_points, total_score, risk_band, recommendation, scored_by, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [
        appIds[cd.idx], apps[cd.idx].bid, cd.cibil, cd.dti, cd.emp_score, cd.inc_score,
        cibilPts, dtiPts, total, risk, rec, analystId,
        `Automated rule-based scoring. CIBIL: ${cd.cibil}, DTI: ${cd.dti}%`
      ]);
    }
    console.log('✅ Credit scores created');

    // EMI Calculator helper
    function calcEMI(principal, annualRate, months) {
      const r = annualRate / 12 / 100;
      if (r === 0) return principal / months;
      return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
    }

    function buildSchedule(principal, annualRate, months, startDate) {
      const r = annualRate / 12 / 100;
      const emi = calcEMI(principal, annualRate, months);
      const schedule = [];
      let balance = principal;
      let date = new Date(startDate);

      for (let i = 1; i <= months; i++) {
        const interest = parseFloat((balance * r).toFixed(2));
        const principalComp = parseFloat((emi - interest).toFixed(2));
        const newBalance = parseFloat(Math.max(0, balance - principalComp).toFixed(2));
        schedule.push({
          num: i, due: new Date(date),
          principal: principalComp, interest, emi: parseFloat(emi.toFixed(2)),
          outstanding: newBalance
        });
        balance = newBalance;
        date = new Date(date.setMonth(date.getMonth() + 1));
      }
      return schedule;
    }

    // Loan accounts for disbursed apps (indices 6, 7, 8)
    const disbursedConfigs = [
      { idx: 6, principal: 300000, rate: 13.0, tenure: 12, startOffset: -8 }, // 8 months ago
      { idx: 7, principal: 500000, rate: 15.5, tenure: 18, startOffset: -6 }, // 6 months ago, some overdue
      { idx: 8, principal: 2500000, rate: 8.5, tenure: 180, startOffset: -3 }, // 3 months ago
    ];

    const loanAccountIds = [];
    for (let di = 0; di < disbursedConfigs.length; di++) {
      const dc = disbursedConfigs[di];
      const emi = parseFloat(calcEMI(dc.principal, dc.rate, dc.tenure).toFixed(2));
      const disbDate = new Date();
      disbDate.setMonth(disbDate.getMonth() + dc.startOffset);

      const firstEmiDate = new Date(disbDate);
      firstEmiDate.setMonth(firstEmiDate.getMonth() + 1);

      const accRes = await client.query(`
        INSERT INTO loan_accounts
          (account_number, application_id, borrower_id, principal_amount, interest_rate,
           tenure_months, emi_amount, outstanding_balance, disbursement_date, first_emi_date, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Active')
        RETURNING id
      `, [
        makeAccNum(di + 1), appIds[dc.idx], apps[dc.idx].bid,
        dc.principal, dc.rate, dc.tenure, emi, dc.principal,
        disbDate.toISOString().split('T')[0],
        firstEmiDate.toISOString().split('T')[0]
      ]);
      const accId = accRes.rows[0].id;
      loanAccountIds.push(accId);

      // Build EMI schedule
      const schedule = buildSchedule(dc.principal, dc.rate, dc.tenure, firstEmiDate);
      const today = new Date();
      let outstanding = dc.principal;
      let totalPaid = 0;

      for (const s of schedule) {
        const isPast = s.due < today;
        // For account 2 (index 1), make last 2 EMIs overdue (simulate DPD)
        const isOverdue = di === 1 && isPast && s.num >= 5;
        const status = isOverdue ? 'Overdue' : (isPast ? 'Paid' : 'Pending');
        const paidAmt = status === 'Paid' ? s.emi : 0;
        const paidDate = status === 'Paid' ? s.due.toISOString().split('T')[0] : null;

        await client.query(`
          INSERT INTO emi_schedule
            (loan_account_id, emi_number, due_date, principal_component, interest_component,
             emi_amount, outstanding_after, status, paid_amount, paid_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [accId, s.num, s.due.toISOString().split('T')[0], s.principal, s.interest,
           s.emi, s.outstanding, status, paidAmt, paidDate]);

        if (status === 'Paid') {
          totalPaid += s.emi;
          outstanding = s.outstanding;
        }
      }

      // Update outstanding balance
      await client.query(
        'UPDATE loan_accounts SET outstanding_balance=$1, total_paid=$2 WHERE id=$3',
        [outstanding, totalPaid, accId]
      );

      // Insert payments for paid EMIs
      const paidEmis = await client.query(
        "SELECT id, paid_date, emi_amount FROM emi_schedule WHERE loan_account_id=$1 AND status='Paid'",
        [accId]
      );
      for (const pe of paidEmis.rows) {
        await client.query(`
          INSERT INTO payments
            (loan_account_id, emi_schedule_id, amount, payment_mode, reference_number, payment_date, recorded_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [accId, pe.id, pe.emi_amount, 'Auto-debit',
           `REF${Date.now()}${Math.floor(Math.random()*9999)}`,
           pe.paid_date, adminId]);
      }
    }
    console.log('✅ Loan accounts, EMI schedules, and payments created');

    // Collections log for overdue account (loanAccountIds[1])
    const overdueAccId = loanAccountIds[1];
    await client.query(`
      INSERT INTO collections_log
        (loan_account_id, borrower_id, agent_id, contact_type, outcome, ptp_date, ptp_amount, dpd_at_contact, notes)
      VALUES
        ($1, $2, $3, 'Call', 'PTP', CURRENT_DATE + INTERVAL '3 days', 29000, 35, 'Borrower promised to pay both overdue EMIs within 3 days. Financial difficulty cited.'),
        ($1, $2, $3, 'SMS', 'No Response', NULL, NULL, 42, 'Sent payment reminder SMS. No response received.')
    `, [overdueAccId, apps[7].bid, collectionsId]);
    console.log('✅ Collections log created');

    // Documents for a few applications
    await client.query(`
      INSERT INTO documents (application_id, borrower_id, doc_type, file_name, file_path, status) VALUES
        ($1, $2, 'PAN Card', 'pan_rahul.pdf', '/uploads/pan_rahul.pdf', 'Verified'),
        ($1, $2, 'Aadhaar Card', 'aadhaar_rahul.pdf', '/uploads/aadhaar_rahul.pdf', 'Verified'),
        ($1, $2, 'Salary Slip', 'salary_rahul.pdf', '/uploads/salary_rahul.pdf', 'Pending'),
        ($3, $4, 'PAN Card', 'pan_neha.pdf', '/uploads/pan_neha.pdf', 'Verified'),
        ($3, $4, 'Bank Statement', 'bank_neha.pdf', '/uploads/bank_neha.pdf', 'Verified')
    `, [appIds[0], borrowers[0].id, appIds[1], borrowers[1].id]);
    console.log('✅ Documents created');

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login Credentials (password: Admin123!):');
    console.log('   Admin:             admin@lms.com');
    console.log('   Loan Officer:      officer@lms.com');
    console.log('   Credit Analyst:    analyst@lms.com');
    console.log('   Collections Agent: collections@lms.com');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

seed().catch(() => process.exit(1));
