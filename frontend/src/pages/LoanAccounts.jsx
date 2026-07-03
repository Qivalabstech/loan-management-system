import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { accountsAPI, paymentsAPI } from '../services/api';
import { Search, ExternalLink, Plus } from 'lucide-react';

const STATUS_COLORS = {
  Active: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-600',
  NPA: 'bg-red-100 text-red-700',
  'Written Off': 'bg-red-200 text-red-800',
};
const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

export default function LoanAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', payment_mode: 'NEFT', reference_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
  const [payError, setPayError] = useState('');
  const [paying, setPaying] = useState(false);
  const limit = 15;

  const fetchAccounts = useCallback(() => {
    setLoading(true);
    accountsAPI.list({ page, limit, status: statusFilter||undefined, search: search||undefined })
      .then(r => { setAccounts(r.data.accounts); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openPayModal = (acc) => {
    setSelectedAcc(acc);
    setPayForm({ amount: acc.emi_amount, payment_mode: 'NEFT', reference_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '' });
    setPayError('');
    setShowPayModal(true);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setPaying(true);
    setPayError('');
    try {
      await paymentsAPI.create({ loan_account_id: selectedAcc.id, ...payForm });
      setShowPayModal(false);
      fetchAccounts();
    } catch (err) {
      setPayError(err.response?.data?.error || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search account# or borrower…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-40" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {['Active','Closed','NPA','Written Off'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                {['Account #','Borrower','Type','Principal','Outstanding','EMI','Status','Disbursed','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading…</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No loan accounts found</td></tr>
              ) : accounts.map(acc => (
                <tr key={acc.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{acc.account_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{acc.full_name}</p>
                    <p className="text-xs text-slate-400">{acc.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{acc.loan_type}</td>
                  <td className="px-4 py-3 font-medium">{fmt(acc.principal_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${parseFloat(acc.outstanding_balance) > 0 ? 'text-slate-800' : 'text-green-600'}`}>
                      {fmt(acc.outstanding_balance)}
                    </span>
                    {parseInt(acc.overdue_count) > 0 && (
                      <p className="text-xs text-red-500">{acc.overdue_count} EMI overdue</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{fmt(acc.emi_amount)}</td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_COLORS[acc.status] || ''}`}>{acc.status}</span></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(acc.disbursement_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link to={`/loan-accounts/${acc.id}`} className="btn-ghost p-1.5 rounded-md"><ExternalLink className="w-4 h-4" /></Link>
                      {acc.status === 'Active' && (
                        <button onClick={() => openPayModal(acc)} className="btn-ghost p-1.5 rounded-md text-green-600 hover:bg-green-50" title="Record Payment">
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>{total} accounts</span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</button>
              <span className="px-3 py-1">{page}/{totalPages}</span>
              <button className="btn-secondary px-3 py-1" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showPayModal && selectedAcc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold">Record Payment — {selectedAcc.account_number}</h3>
              <p className="text-sm text-slate-500">Borrower: {selectedAcc.full_name}</p>
            </div>
            <form onSubmit={handlePay} className="p-5 space-y-4">
              {payError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{payError}</div>}
              <div>
                <label className="label">Amount (₹) *</label>
                <input className="input" type="number" required value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} />
                <p className="text-xs text-slate-400 mt-1">EMI amount: {fmt(selectedAcc.emi_amount)}</p>
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select className="input" value={payForm.payment_mode} onChange={e => setPayForm(f => ({...f, payment_mode: e.target.value}))}>
                  {['NEFT','RTGS','UPI','Cash','Cheque','Auto-debit','IMPS'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Reference Number</label>
                <input className="input" value={payForm.reference_number} onChange={e => setPayForm(f => ({...f, reference_number: e.target.value}))} />
              </div>
              <div>
                <label className="label">Payment Date *</label>
                <input className="input" type="date" required value={payForm.payment_date} onChange={e => setPayForm(f => ({...f, payment_date: e.target.value}))} />
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowPayModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={paying}>{paying ? 'Processing…' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
