# Loan Management System (LOS/LMS)

A full-stack Loan Origination & Management System built with Node.js + Express + PostgreSQL + React + Tailwind CSS.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Database Setup
```bash
# Create database
createdb loan_management

# Apply schema
psql loan_management -f backend/database/schema.sql

# Seed sample data (10 loans in various stages)
node backend/database/seed.js
```

### 2. Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set DATABASE_URL to your PostgreSQL connection string
# e.g. DATABASE_URL=postgresql://postgres:password@localhost:5432/loan_management
```

### 3. Run the App
```bash
# From project root — starts both frontend (:3000) and backend (:5000)
npm run dev
```

Open http://localhost:3000

---

## Login Credentials (after seeding)

| Role              | Email                    | Password   |
|-------------------|--------------------------|------------|
| Admin             | admin@lms.com            | Admin123!  |
| Loan Officer      | officer@lms.com          | Admin123!  |
| Credit Analyst    | analyst@lms.com          | Admin123!  |
| Collections Agent | collections@lms.com      | Admin123!  |

---

## Modules

| Module | Description |
|--------|-------------|
| **Auth** | JWT login, 4 roles, route guards |
| **Leads** | Capture & track loan enquiries |
| **Applications** | 3-step application form (borrower → loan → employment) |
| **Workflow** | 7-stage: Draft → Submitted → Under Review → Credit Check → Approved → Rejected → Disbursed |
| **Credit Scoring** | Rule-based engine: CIBIL + DTI + Employment + Income (0–100 score) |
| **Loan Accounts** | Disburse approved loans, view EMI schedule & payments |
| **EMI Calculator** | Client-side EMI & full amortization schedule |
| **Collections** | Overdue accounts with DPD tracking, contact logging, PTP management |
| **Reports** | Collection efficiency, NPA tracker, disbursement report, audit log |
| **Notifications** | Email alerts on status changes via Nodemailer (Ethereal in dev) |

---

## API Routes

```
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/register          (Admin only)

GET  /api/leads                  paginated + search + filter
POST /api/leads
PUT  /api/leads/:id
DELETE /api/leads/:id

GET  /api/applications           paginated + status/type filter
POST /api/applications
GET  /api/applications/:id
POST /api/applications/:id/advance
POST /api/applications/:id/reject
GET  /api/applications/borrowers
POST /api/applications/borrowers

POST /api/credit-scoring/score/:applicationId
GET  /api/credit-scoring

GET  /api/loan-accounts
GET  /api/loan-accounts/:id
POST /api/loan-accounts/disburse

POST /api/payments

GET  /api/collections/overdue
GET  /api/collections
POST /api/collections

GET  /api/reports/summary
GET  /api/reports/disbursement
GET  /api/reports/collection-efficiency
GET  /api/reports/npa
GET  /api/reports/funnel
GET  /api/reports/audit

POST /api/documents/upload       (multipart/form-data)
PATCH /api/documents/:id/verify
```

---

## Credit Scoring Rules (Rule-Based Engine)

| Factor | Max Points | Criteria |
|--------|-----------|----------|
| CIBIL Score | 30 | 750+ → 30, 700-749 → 22, 650-699 → 15, <650 → 5 |
| DTI Ratio | 25 | <30% → 25, 30-40% → 18, 40-50% → 10, >50% → 3 |
| Employment | 20 | Salaried → 20, Business → 15, Self-Employed → 12 |
| Income | 25 | >2L → 25, 1-2L → 20, 50k-1L → 15, <50k → 8 |

**Risk Bands:** 80+ → Low (Approve), 65-79 → Medium, 45-64 → High, <45 → Very High (Decline)

---

## Tech Stack

- **Backend**: Node.js, Express 4, PostgreSQL (pg pool), JWT, bcryptjs, multer, nodemailer
- **Frontend**: React 18, Vite, Tailwind CSS v3, React Router v6, recharts, lucide-react, axios
- **Database**: 11 tables with indexes, FK constraints, audit logging
