import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const tabs = ['Collection Efficiency','NPA Tracker','Disbursement Report','Audit Log'];

export default function Reports() {
  const [tab, setTab] = useState(0);
  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===i ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 0 && <CollectionEfficiency />}
      {tab === 1 && <NPATracker />}
      {tab === 2 && <DisbursementReport />}
      {tab === 3 && <AuditLog />}
    </div>
  );
}

function CollectionEfficiency() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    reportsAPI.collectionEfficiency().then(r => setData(r.data.report || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const chartData = data.map(d => ({
    month: new Date(d.month).toLocaleString('default', { month: 'short', year: '2-digit' }),
    efficiency: parseFloat(d.efficiency_pct || 0),
    paid: parseInt(d.paid || 0),
    overdue: parseInt(d.overdue || 0),
  })).reverse();

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-4">Collection Efficiency (%) by Month</h3>
        {loading ? <div className="h-60 flex items-center justify-center text-slate-400">Loading…</div> : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0,100]} unit="%" />
              <Tooltip formatter={v => [`${v}%`, 'Efficiency']} />
              <Line type="monotone" dataKey="efficiency" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="h-60 flex items-center justify-center text-slate-400">No data yet</div>}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr>
              {['Month','Total EMIs','Paid','Overdue','Scheduled','Collected','Efficiency'].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map(row => (
                <tr key={row.month} className="table-row">
                  <td className="px-4 py-3">{new Date(row.month).toLocaleString('default', { month: 'long', year: 'numeric' })}</td>
                  <td className="px-4 py-3">{row.total_emis}</td>
                  <td className="px-4 py-3 text-green-600">{row.paid}</td>
                  <td className="px-4 py-3 text-red-600">{row.overdue}</td>
                  <td className="px-4 py-3">{fmt(row.scheduled_amount)}</td>
                  <td className="px-4 py-3 font-medium">{fmt(row.collected_amount)}</td>
                  <td className="px-4 py-3"><span className={`badge ${parseFloat(row.efficiency_pct) >= 90 ? 'bg-green-100 text-green-700' : parseFloat(row.efficiency_pct) >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{row.efficiency_pct}%</span></td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NPATracker() {
  const [data, setData] = useState({ npaAccounts: [], totals: {} });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    reportsAPI.npa().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 text-center">
          <p className="text-sm text-slate-500">NPA Accounts</p>
          <p className="text-3xl font-bold text-red-600">{data.totals?.npa_count || 0}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm text-slate-500">NPA Outstanding</p>
          <p className="text-3xl font-bold text-red-600">{fmt(data.totals?.npa_outstanding)}</p>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr>
              {['Account #','Borrower','Outstanding','Overdue EMIs','Overdue Amount','DPD','Status'].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading…</td></tr>
              : data.npaAccounts.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No overdue accounts</td></tr>
              : data.npaAccounts.map(acc => (
                <tr key={acc.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{acc.account_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{acc.full_name}</p>
                    <p className="text-xs text-slate-400">{acc.phone}</p>
                  </td>
                  <td className="px-4 py-3">{fmt(acc.outstanding_balance)}</td>
                  <td className="px-4 py-3 text-red-600">{acc.overdue_emis}</td>
                  <td className="px-4 py-3 text-red-600 font-medium">{fmt(acc.overdue_amount)}</td>
                  <td className={`px-4 py-3 font-bold ${parseInt(acc.dpd) > 90 ? 'text-red-700' : 'text-red-500'}`}>{acc.dpd} days</td>
                  <td className="px-4 py-3"><span className={`badge ${acc.status==='NPA' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{acc.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DisbursementReport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState({ disbursements: [], summary: {} });
  const [loading, setLoading] = useState(false);

  const fetchReport = () => {
    setLoading(true);
    reportsAPI.disbursement({ from: from || undefined, to: to || undefined })
      .then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchReport(); }, []);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-end gap-4 flex-wrap">
        <div><label className="label">From Date</label><input type="date" className="input w-44" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label">To Date</label><input type="date" className="input w-44" value={to} onChange={e => setTo(e.target.value)} /></div>
        <button className="btn-primary" onClick={fetchReport}>Apply Filter</button>
      </div>
      {data.summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center"><p className="text-sm text-slate-500">Count</p><p className="text-2xl font-bold text-slate-800">{data.summary.count || 0}</p></div>
          <div className="card p-4 text-center"><p className="text-sm text-slate-500">Total Disbursed</p><p className="text-2xl font-bold text-blue-600">{fmt(data.summary.total_disbursed)}</p></div>
          <div className="card p-4 text-center"><p className="text-sm text-slate-500">Avg Rate</p><p className="text-2xl font-bold text-slate-800">{data.summary.avg_rate ? `${parseFloat(data.summary.avg_rate).toFixed(2)}%` : '—'}</p></div>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head"><tr>
              {['Account #','App #','Borrower','Type','Amount','Rate','Tenure','EMI','Date','Status'].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="text-center py-8 text-slate-400">Loading…</td></tr>
              : data.disbursements.length === 0 ? <tr><td colSpan={10} className="text-center py-8 text-slate-400">No disbursements</td></tr>
              : data.disbursements.map(d => (
                <tr key={d.account_number} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{d.account_number}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.application_number}</td>
                  <td className="px-4 py-3 font-medium">{d.full_name}</td>
                  <td className="px-4 py-3">{d.loan_type}</td>
                  <td className="px-4 py-3">{fmt(d.principal_amount)}</td>
                  <td className="px-4 py-3">{d.interest_rate}%</td>
                  <td className="px-4 py-3">{d.tenure_months}m</td>
                  <td className="px-4 py-3">{fmt(d.emi_amount)}</td>
                  <td className="px-4 py-3 text-xs">{new Date(d.disbursement_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><span className="badge bg-green-100 text-green-700">{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    reportsAPI.audit({ page, limit: 50 })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / 50);
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head"><tr>
            {['Action','User','Entity','ID','Time'].map(h => <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">Loading…</td></tr>
            : logs.map(log => (
              <tr key={log.id} className="table-row">
                <td className="px-4 py-3"><span className="badge bg-blue-50 text-blue-700 font-mono text-xs">{log.action}</span></td>
                <td className="px-4 py-3 text-slate-600">{log.user_name || 'System'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{log.entity_type}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{log.entity_id}</td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(log.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No audit logs</td></tr>}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <span>{total} entries</span>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-1" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</button>
            <span>{page}/{totalPages}</span>
            <button className="btn-secondary px-3 py-1" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
