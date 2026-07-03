import { useState, useEffect } from 'react';
import { collectionsAPI } from '../services/api';
import { Phone, Mail, MapPin, AlertTriangle } from 'lucide-react';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const DPD_COLOR = (dpd) => dpd > 90 ? 'text-red-700 font-bold' : dpd > 30 ? 'text-red-600' : dpd > 0 ? 'text-amber-600' : 'text-slate-600';
const CONTACT_TYPES = ['Call','SMS','Email','Field Visit','Legal Notice','WhatsApp'];
const OUTCOMES = ['PTP','No Response','Paid','Disputed','Unable to Contact','Refused to Pay','Partially Paid'];

export default function Collections() {
  const [overdueAccounts, setOverdueAccounts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('overdue');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAcc, setSelectedAcc] = useState(null);
  const [logForm, setLogForm] = useState({ contact_type: 'Call', outcome: 'No Response', ptp_date: '', ptp_amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchOverdue = () => {
    setLoading(true);
    collectionsAPI.overdue()
      .then(r => setOverdueAccounts(r.data.overdueAccounts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchLogs = () => {
    setLoading(true);
    collectionsAPI.list({ limit: 50 })
      .then(r => setLogs(r.data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'overdue') fetchOverdue();
    else fetchLogs();
  }, [tab]);

  const openContactModal = (acc) => {
    setSelectedAcc(acc);
    setLogForm({ contact_type: 'Call', outcome: 'No Response', ptp_date: '', ptp_amount: '', notes: '' });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await collectionsAPI.create({ loan_account_id: selectedAcc.id, ...logForm });
      setShowModal(false);
      if (tab === 'overdue') fetchOverdue(); else fetchLogs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[['overdue','Overdue Accounts'],['logs','Contact Logs']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overdue' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  {['Account #','Borrower','Type','Outstanding','Overdue EMIs','Overdue Amount','DPD','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">Loading…</td></tr>
                ) : overdueAccounts.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    No overdue accounts
                  </td></tr>
                ) : overdueAccounts.map(acc => (
                  <tr key={acc.id} className="table-row">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{acc.account_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{acc.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {acc.phone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{acc.phone}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{acc.loan_type}</td>
                    <td className="px-4 py-3 font-medium">{fmt(acc.outstanding_balance)}</td>
                    <td className="px-4 py-3 text-center">{acc.overdue_emis || 0}</td>
                    <td className="px-4 py-3 font-medium text-red-600">{fmt(acc.overdue_amount)}</td>
                    <td className={`px-4 py-3 font-bold ${DPD_COLOR(parseInt(acc.dpd)||0)}`}>{acc.dpd || 0} days</td>
                    <td className="px-4 py-3">
                      <button className="btn-secondary text-xs px-3 py-1" onClick={() => openContactModal(acc)}>
                        Log Contact
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  {['Account #','Borrower','Contact Type','Outcome','PTP Date','PTP Amount','DPD','Agent','Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading…</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">No contact logs yet</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="table-row">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{log.account_number}</td>
                    <td className="px-4 py-3 font-medium">{log.full_name}</td>
                    <td className="px-4 py-3">{log.contact_type}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${log.outcome === 'PTP' ? 'bg-blue-100 text-blue-700' : log.outcome === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {log.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{log.ptp_date ? new Date(log.ptp_date).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-4 py-3">{log.ptp_amount ? fmt(log.ptp_amount) : '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${DPD_COLOR(parseInt(log.dpd_at_contact)||0)}`}>{log.dpd_at_contact || 0}d</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{log.agent_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(log.contacted_at).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && selectedAcc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-semibold">Log Contact — {selectedAcc.account_number}</h3>
              <p className="text-sm text-slate-500">{selectedAcc.full_name} · DPD: {selectedAcc.dpd || 0} days</p>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
              <div>
                <label className="label">Contact Type</label>
                <select className="input" value={logForm.contact_type} onChange={e => setLogForm(f => ({...f, contact_type: e.target.value}))}>
                  {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Outcome</label>
                <select className="input" value={logForm.outcome} onChange={e => setLogForm(f => ({...f, outcome: e.target.value}))}>
                  {OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              {logForm.outcome === 'PTP' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">PTP Date</label>
                    <input className="input" type="date" value={logForm.ptp_date} onChange={e => setLogForm(f => ({...f, ptp_date: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">PTP Amount (₹)</label>
                    <input className="input" type="number" value={logForm.ptp_amount} onChange={e => setLogForm(f => ({...f, ptp_amount: e.target.value}))} />
                  </div>
                </div>
              )}
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={logForm.notes} onChange={e => setLogForm(f => ({...f, notes: e.target.value}))} />
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : 'Log Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
