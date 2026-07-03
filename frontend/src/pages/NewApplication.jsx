import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { applicationsAPI } from '../services/api';
import { Search } from 'lucide-react';

const LOAN_TYPES = ['Personal','Home','Business','Auto','Education','Gold','Mortgage'];
const EMP_TYPES = ['Salaried','Self-Employed','Business','Retired','Unemployed'];

export default function NewApplication() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=Borrower, 2=Loan, 3=Employment/Financial
  const [borrowerSearch, setBorrowerSearch] = useState('');
  const [borrowers, setBorrowers] = useState([]);
  const [selectedBorrower, setSelectedBorrower] = useState(null);
  const [newBorrower, setNewBorrower] = useState(false);
  const [bForm, setBForm] = useState({ full_name:'', email:'', phone:'', dob:'', pan_number:'', aadhaar_number:'', address:'', city:'', state:'', pincode:'' });
  const [lForm, setLForm] = useState({ loan_type:'Personal', loan_amount:'', tenure_months:'12', interest_rate:'12', purpose:'' });
  const [eForm, setEForm] = useState({ employment_type:'Salaried', employer_name:'', monthly_income:'', monthly_expenses:'', existing_emi:'0' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (borrowerSearch.length < 2) { setBorrowers([]); return; }
    const t = setTimeout(() => {
      applicationsAPI.getBorrowers({ search: borrowerSearch })
        .then(r => setBorrowers(r.data.borrowers || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [borrowerSearch]);

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      let borrowerId = selectedBorrower?.id;
      if (!borrowerId && newBorrower) {
        const res = await applicationsAPI.createBorrower(bForm);
        borrowerId = res.data.borrower.id;
      }
      if (!borrowerId) { setError('Select or create a borrower'); setSaving(false); return; }

      const res = await applicationsAPI.create({ borrower_id: borrowerId, ...lForm, ...eForm });
      navigate(`/applications/${res.data.application.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create application');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex gap-2">
        {['Borrower','Loan Details','Employment & Financials'].map((label, i) => (
          <div key={label} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium text-center border-2 transition-colors ${
            step === i+1 ? 'border-blue-600 bg-blue-50 text-blue-700' : step > i+1 ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-400'
          }`}>
            {i+1}. {label}
          </div>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

      {step === 1 && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">Select Borrower</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search by name, phone or PAN…"
              value={borrowerSearch} onChange={e => { setBorrowerSearch(e.target.value); setSelectedBorrower(null); }} />
          </div>
          {borrowers.length > 0 && !selectedBorrower && (
            <div className="border border-slate-200 rounded-lg divide-y">
              {borrowers.map(b => (
                <button key={b.id} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors" onClick={() => { setSelectedBorrower(b); setNewBorrower(false); }}>
                  <p className="font-medium">{b.full_name}</p>
                  <p className="text-xs text-slate-500">{b.phone} · {b.pan_number}</p>
                </button>
              ))}
            </div>
          )}
          {selectedBorrower && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-800">{selectedBorrower.full_name}</p>
                <p className="text-sm text-green-600">{selectedBorrower.phone} · {selectedBorrower.city}</p>
              </div>
              <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setSelectedBorrower(null)}>Change</button>
            </div>
          )}
          {!selectedBorrower && (
            <div>
              <button className={`btn-secondary ${newBorrower ? 'border-blue-400 bg-blue-50' : ''}`} onClick={() => setNewBorrower(v => !v)}>
                + Create New Borrower
              </button>
              {newBorrower && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {[['full_name','Full Name *',true],['email','Email',false],['phone','Phone *',true],['dob','Date of Birth',false],['pan_number','PAN Number',false],['aadhaar_number','Aadhaar',false]].map(([k,label,req]) => (
                    <div key={k}>
                      <label className="label">{label}</label>
                      <input className="input" required={req} type={k==='dob'?'date':'text'}
                        value={bForm[k]} onChange={e => setBForm(f => ({...f, [k]: e.target.value}))} />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="label">Address</label>
                    <input className="input" value={bForm.address} onChange={e => setBForm(f => ({...f, address: e.target.value}))} />
                  </div>
                  <div><label className="label">City</label><input className="input" value={bForm.city} onChange={e => setBForm(f => ({...f, city: e.target.value}))} /></div>
                  <div><label className="label">State</label><input className="input" value={bForm.state} onChange={e => setBForm(f => ({...f, state: e.target.value}))} /></div>
                  <div><label className="label">Pincode</label><input className="input" value={bForm.pincode} onChange={e => setBForm(f => ({...f, pincode: e.target.value}))} /></div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <button className="btn-primary" disabled={!selectedBorrower && !(newBorrower && bForm.full_name && bForm.phone)} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">Loan Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Loan Type *</label>
              <select className="input" value={lForm.loan_type} onChange={e => setLForm(f => ({...f, loan_type: e.target.value}))}>
                {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Loan Amount (₹) *</label>
              <input className="input" type="number" required value={lForm.loan_amount} onChange={e => setLForm(f => ({...f, loan_amount: e.target.value}))} />
            </div>
            <div>
              <label className="label">Tenure (months) *</label>
              <input className="input" type="number" required value={lForm.tenure_months} onChange={e => setLForm(f => ({...f, tenure_months: e.target.value}))} />
            </div>
            <div>
              <label className="label">Interest Rate (% p.a.)</label>
              <input className="input" type="number" step="0.01" value={lForm.interest_rate} onChange={e => setLForm(f => ({...f, interest_rate: e.target.value}))} />
            </div>
            <div className="col-span-2">
              <label className="label">Purpose</label>
              <textarea className="input" rows={2} value={lForm.purpose} onChange={e => setLForm(f => ({...f, purpose: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary" disabled={!lForm.loan_amount || !lForm.tenure_months} onClick={() => setStep(3)}>Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-800">Employment & Financial Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employment Type</label>
              <select className="input" value={eForm.employment_type} onChange={e => setEForm(f => ({...f, employment_type: e.target.value}))}>
                {EMP_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Employer Name</label>
              <input className="input" value={eForm.employer_name} onChange={e => setEForm(f => ({...f, employer_name: e.target.value}))} />
            </div>
            <div>
              <label className="label">Monthly Income (₹)</label>
              <input className="input" type="number" value={eForm.monthly_income} onChange={e => setEForm(f => ({...f, monthly_income: e.target.value}))} />
            </div>
            <div>
              <label className="label">Monthly Expenses (₹)</label>
              <input className="input" type="number" value={eForm.monthly_expenses} onChange={e => setEForm(f => ({...f, monthly_expenses: e.target.value}))} />
            </div>
            <div>
              <label className="label">Existing EMI Obligations (₹)</label>
              <input className="input" type="number" value={eForm.existing_emi} onChange={e => setEForm(f => ({...f, existing_emi: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => setStep(2)}>Back</button>
            <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
              {saving ? 'Creating…' : 'Create Application'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
