-- Loan Management System Schema
-- Run: psql $DATABASE_URL -f backend/database/schema.sql

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS collections_log CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS emi_schedule CASCADE;
DROP TABLE IF EXISTS loan_accounts CASCADE;
DROP TABLE IF EXISTS credit_scores CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS loan_applications CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS borrowers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Admin','Loan Officer','Credit Analyst','Collections Agent')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE borrowers (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  dob DATE,
  pan_number VARCHAR(20),
  aadhaar_number VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20) NOT NULL,
  loan_type VARCHAR(50),
  loan_amount NUMERIC(15,2),
  source VARCHAR(50) DEFAULT 'Website' CHECK (source IN ('Website','Referral','Walk-in','Campaign','Social Media','Partner')),
  status VARCHAR(30) DEFAULT 'New' CHECK (status IN ('New','Contacted','Qualified','Converted','Dropped')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loan_applications (
  id SERIAL PRIMARY KEY,
  application_number VARCHAR(20) UNIQUE NOT NULL,
  borrower_id INTEGER REFERENCES borrowers(id) ON DELETE RESTRICT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  assigned_officer INTEGER REFERENCES users(id) ON DELETE SET NULL,
  loan_type VARCHAR(50) NOT NULL CHECK (loan_type IN ('Personal','Home','Business','Auto','Education','Gold','Mortgage')),
  loan_amount NUMERIC(15,2) NOT NULL,
  tenure_months INTEGER NOT NULL,
  interest_rate NUMERIC(5,2) DEFAULT 12.00,
  purpose TEXT,
  employment_type VARCHAR(50) CHECK (employment_type IN ('Salaried','Self-Employed','Business','Retired','Unemployed')),
  employer_name VARCHAR(150),
  monthly_income NUMERIC(15,2),
  monthly_expenses NUMERIC(15,2),
  existing_emi NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','Under Review','Credit Check','Approved','Rejected','Disbursed')),
  rejection_reason TEXT,
  approved_amount NUMERIC(15,2),
  approved_rate NUMERIC(5,2),
  approved_tenure INTEGER,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES loan_applications(id) ON DELETE CASCADE,
  borrower_id INTEGER REFERENCES borrowers(id) ON DELETE CASCADE,
  doc_type VARCHAR(80) NOT NULL,
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  file_size INTEGER,
  mime_type VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by INTEGER REFERENCES users(id)
);

CREATE TABLE credit_scores (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES loan_applications(id) ON DELETE CASCADE,
  borrower_id INTEGER REFERENCES borrowers(id),
  cibil_score INTEGER,
  dti_ratio NUMERIC(5,2),
  employment_score INTEGER,
  income_score INTEGER,
  cibil_score_points INTEGER,
  dti_score_points INTEGER,
  total_score INTEGER,
  risk_band VARCHAR(20) CHECK (risk_band IN ('Low','Medium','High','Very High')),
  recommendation VARCHAR(20) CHECK (recommendation IN ('Approve','Decline','Manual Review')),
  scored_by INTEGER REFERENCES users(id),
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE TABLE loan_accounts (
  id SERIAL PRIMARY KEY,
  account_number VARCHAR(20) UNIQUE NOT NULL,
  application_id INTEGER REFERENCES loan_applications(id) ON DELETE RESTRICT,
  borrower_id INTEGER REFERENCES borrowers(id) ON DELETE RESTRICT,
  principal_amount NUMERIC(15,2) NOT NULL,
  interest_rate NUMERIC(5,2) NOT NULL,
  tenure_months INTEGER NOT NULL,
  emi_amount NUMERIC(15,2) NOT NULL,
  outstanding_balance NUMERIC(15,2) NOT NULL,
  total_paid NUMERIC(15,2) DEFAULT 0,
  disbursement_date DATE NOT NULL,
  first_emi_date DATE NOT NULL,
  last_payment_date DATE,
  status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active','Closed','NPA','Written Off')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE emi_schedule (
  id SERIAL PRIMARY KEY,
  loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
  emi_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_component NUMERIC(15,2) NOT NULL,
  interest_component NUMERIC(15,2) NOT NULL,
  emi_amount NUMERIC(15,2) NOT NULL,
  outstanding_after NUMERIC(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending','Paid','Partial','Overdue')),
  paid_amount NUMERIC(15,2) DEFAULT 0,
  paid_date DATE,
  UNIQUE(loan_account_id, emi_number)
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE RESTRICT,
  emi_schedule_id INTEGER REFERENCES emi_schedule(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL,
  payment_mode VARCHAR(30) DEFAULT 'NEFT' CHECK (payment_mode IN ('NEFT','RTGS','UPI','Cash','Cheque','Auto-debit','IMPS')),
  reference_number VARCHAR(100),
  payment_date DATE NOT NULL,
  recorded_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collections_log (
  id SERIAL PRIMARY KEY,
  loan_account_id INTEGER REFERENCES loan_accounts(id) ON DELETE CASCADE,
  borrower_id INTEGER REFERENCES borrowers(id),
  agent_id INTEGER REFERENCES users(id),
  contact_type VARCHAR(30) CHECK (contact_type IN ('Call','SMS','Email','Field Visit','Legal Notice','WhatsApp')),
  outcome VARCHAR(50) CHECK (outcome IN ('PTP','No Response','Paid','Disputed','Unable to Contact','Refused to Pay','Partially Paid')),
  ptp_date DATE,
  ptp_amount NUMERIC(15,2),
  dpd_at_contact INTEGER,
  notes TEXT,
  contacted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_applications_borrower ON loan_applications(borrower_id);
CREATE INDEX idx_applications_status ON loan_applications(status);
CREATE INDEX idx_applications_officer ON loan_applications(assigned_officer);
CREATE INDEX idx_emi_schedule_account ON emi_schedule(loan_account_id);
CREATE INDEX idx_emi_schedule_status ON emi_schedule(status);
CREATE INDEX idx_emi_schedule_due_date ON emi_schedule(due_date);
CREATE INDEX idx_payments_account ON payments(loan_account_id);
CREATE INDEX idx_collections_account ON collections_log(loan_account_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
