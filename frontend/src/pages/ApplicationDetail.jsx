import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { applicationsAPI, accountsAPI } from '../services/api';
import WorkflowStepper from '../components/WorkflowStepper';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, CheckCircle, XCircle, ArrowRight, Building2 } from 'lucide-react';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const STATUS_NEXT_LABEL = {
  Draft: 'Submit Application',
  Submitted: 'Move to Under Review',
  'Under Review': 'Send to Credit Check',
  'Credit Check': 'Approve',
  Approved: 'Disburse Loan',
};

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [approvalForm, setApprovalForm] = useState({ approved_amount: '', approved_rate: '', approved_tenure: '' });
  const [actionError, setActionError] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [disburseDate, setDisburseDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = () => {
    setLoading(true);
    applicationsAPI.get(id).then(res => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  const advance = async () => {
    setAdvancing(true);
    setActionError('');
    try {
      const app = data.application;
      if (app.status === 'Approved') {
        // Disburse
        await accountsAPI.disburse({ application_id: parseInt(id), disbursement_date: disburseDate });
        navigate('/loan-accounts');
        return;
      }
      const payload = {};
      if (app.status === 'Credit Check') {
        if (!approvalForm.approved_amount) { setShowApproveForm(true); setAdvancing(false); return; }
        Object.assign(payload, approvalForm);
      }
      await applicationsAPI.advance(id, payload);
      fetchData();
      setShowApproveForm(false);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Action failed');
    } finally {
      setAdvancing(false);
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) return;
    setRejecting(true);
    try {
      await applicationsAPI.reject(id, { rejection_reason: rejectReason });
      setShowRejectModal(false);
      fetchData();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!data) return <div className="text-center py-12 text-slate-500">Application not found</div>;

  const { application: app, documents, creditScore } = data;
  const canAdvance = hasRole('Admin','Loan Officer','Credit Analyst') && STATUS_NEXT_LABEL[app.status];
  const canReject = hasRole('Admin','Credit Analyst') && !['Draft','Rejected','Disbursed'].includes(app.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/applications')} className="btn-ghost gap-1 p-2 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{app.application_number}</h2>
          <p className="text-sm text-slate-500">{app.full_name} · {app.loan_type} Loan</p>
        </div>
      </div>

      <WorkflowStepper currentStatus={app.status} />

      {actionError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{actionError}</div>}

      {(canAdvance || canReject) && app.status !== 'Disbursed' && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          {app.status === 'Credit Check' && showApproveForm ? (
            <div className="w-full grid grid-cols-3 gap-4">
              <div><label className="label">Approved Amount (₹)</label><input className="input" type="number" value={approvalForm.approved_amount} onChange={e => setApprovalForm(f => ({...f, approved_amount: e.target.value}))} /></div>
              <div><label className="label">Interest Rate (%)</label><input className="input" type="number" step="0.01" value={approvalForm.approved_rate} onChange={e => setApprovalForm(f => ({...f, approved_rate: e.target.value}))} /></div>
              <div><label className="label">Tenure (months)</label><input className="input" type="number" value={approvalForm.approved_tenure} onChange={e => setApprovalForm(f => ({...f, approved_tenure: e.target.value}))} /></div>
              <div className="col-span-3 flex gap-2">
                <button className="btn-primary gap-1" onClick={advance} disabled={advancing || !approvalForm.approved_amount}>
                  <CheckCircle className="w-4 h-4" /> Confirm Approval
                </button>
                <button className="btn-secondary" onClick={() => setShowApproveForm(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              {app.status === 'Approved' && (
                <div>
                  <label className="label">Disbursement Date</label>
                  <input type="date" className="input w-48" value={disburseDate} onChange={e => setDisburseDate(e.target.value)} />
                </div>
              )}
              {canAdvance && (
                <button className="btn-primary gap-2" onClick={advance} disabled={advancing}>
                  {app.status === 'Approved' ? <Building2 className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  {advancing ? 'Processing…' : STATUS_NEXT_LABEL[app.status]}
                </button>
              )}
              {canReject && (
                <button className="btn-danger gap-2" onClick={() => setShowRejectModal(true)}>
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Borrower Details</h3>
          <Detail label="Full Name" value={app.full_name} />
          <Detail label="Phone" value={app.phone} />
          <Detail label="Email" value={app.borrower_email} />
          <Detail label="Date of Birth" value={app.dob ? new Date(app.dob).toLocaleDateString('en-IN') : '—'} />
          <Detail label="PAN Number" value={app.pan_number} />
          <Detail label="Aadhaar" value={app.aadhaar_number} />
          <Detail label="Address" value={[app.address, app.city, app.state, app.pincode].filter(Boolean).join(', ')} />
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Loan Details</h3>
          <Detail label="Loan Type" value={app.loan_type} />
          <Detail label="Applied Amount" value={fmt(app.loan_amount)} />
          <Detail label="Tenure" value={`${app.tenure_months} months`} />
          <Detail label="Interest Rate" value={`${app.interest_rate}% p.a.`} />
          <Detail label="Purpose" value={app.purpose} />
          {app.approved_amount && <>
            <div className="border-t border-slate-100 pt-2" />
            <Detail label="Approved Amount" value={fmt(app.approved_amount)} highlight />
            <Detail label="Approved Rate" value={app.approved_rate ? `${app.approved_rate}%` : '—'} />
            <Detail label="Approved Tenure" value={app.approved_tenure ? `${app.approved_tenure} months` : '—'} />
          </>}
          {app.rejection_reason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <p className="font-medium">Rejection Reason</p>
              <p>{app.rejection_reason}</p>
            </div>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Employment & Financials</h3>
          <Detail label="Employment Type" value={app.employment_type} />
          <Detail label="Employer" value={app.employer_name} />
          <Detail label="Monthly Income" value={fmt(app.monthly_income)} />
          <Detail label="Monthly Expenses" value={fmt(app.monthly_expenses)} />
          <Detail label="Existing EMI" value={fmt(app.existing_emi)} />
        </div>

        {creditScore && (
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Credit Score</h3>
            <div className="flex items-center gap-3">
              <div className={`text-3xl font-bold ${creditScore.total_score >= 80 ? 'text-green-600' : creditScore.total_score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                {creditScore.total_score}/100
              </div>
              <div>
                <span className={`badge text-sm ${creditScore.risk_band === 'Low' ? 'bg-green-100 text-green-700' : creditScore.risk_band === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {creditScore.risk_band} Risk
                </span>
                <p className="text-xs text-slate-500 mt-1">Recommendation: <strong>{creditScore.recommendation}</strong></p>
              </div>
            </div>
            <Detail label="CIBIL Score" value={creditScore.cibil_score} />
            <Detail label="DTI Ratio" value={creditScore.dti_ratio ? `${creditScore.dti_ratio}%` : '—'} />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <ScorePill label="CIBIL" pts={creditScore.cibil_score_points} max={30} />
              <ScorePill label="DTI" pts={creditScore.dti_score_points} max={25} />
              <ScorePill label="Employment" pts={creditScore.employment_score} max={20} />
              <ScorePill label="Income" pts={creditScore.income_score} max={25} />
            </div>
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Documents ({documents.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xs font-bold">
                  {doc.file_name?.split('.').pop()?.toUpperCase() || 'DOC'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.doc_type}</p>
                  <p className="text-xs text-slate-400 truncate">{doc.file_name}</p>
                </div>
                <span className={`badge text-xs ${doc.status === 'Verified' ? 'bg-green-100 text-green-700' : doc.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold text-slate-800 mb-4">Reject Application</h3>
            <textarea className="input" rows={4} placeholder="Provide rejection reason…" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-3 mt-4">
              <button className="btn-secondary flex-1" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn-danger flex-1" disabled={!rejectReason.trim() || rejecting} onClick={reject}>
                {rejecting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, highlight }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-sm text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${highlight ? 'text-blue-700' : 'text-slate-800'}`}>{value || '—'}</span>
    </div>
  );
}

function ScorePill({ label, pts, max }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2">
      <p className="text-slate-500">{label}</p>
      <p className="font-bold text-slate-800">{pts}/{max}</p>
    </div>
  );
}
