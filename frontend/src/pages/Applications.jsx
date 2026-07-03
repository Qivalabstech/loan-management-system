import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { applicationsAPI } from '../services/api';
import { Plus, Search, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  'Credit Check': 'bg-purple-100 text-purple-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Disbursed: 'bg-emerald-100 text-emerald-700',
};

const STATUSES = ['Draft','Submitted','Under Review','Credit Check','Approved','Rejected','Disbursed'];
const LOAN_TYPES = ['Personal','Home','Business','Auto','Education','Gold','Mortgage'];

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

export default function Applications() {
  const { hasRole } = useAuth();
  const [apps, setApps] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 15;

  const fetchApps = useCallback(() => {
    setLoading(true);
    applicationsAPI.list({ page, limit, search: search||undefined, status: statusFilter||undefined, loan_type: typeFilter||undefined })
      .then(res => { setApps(res.data.applications); setTotal(res.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search app# or borrower…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-40" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="input w-40" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        {hasRole('Admin','Loan Officer') && (
          <Link to="/applications/new" className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> New Application
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                {['App #','Borrower','Type','Amount','Tenure','Status','Officer','Date',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading…</td></tr>
              ) : apps.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No applications found</td></tr>
              ) : apps.map(app => (
                <tr key={app.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold">{app.application_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{app.full_name}</p>
                    <p className="text-xs text-slate-400">{app.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{app.loan_type}</td>
                  <td className="px-4 py-3 font-medium">{fmt(app.loan_amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{app.tenure_months}m</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[app.status] || 'bg-slate-100 text-slate-600'}`}>{app.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{app.officer_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(app.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/applications/${app.id}`} className="btn-ghost p-1.5 rounded-md inline-flex">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>{total} applications total</span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</button>
              <span className="px-3 py-1">{page}/{totalPages}</span>
              <button className="btn-secondary px-3 py-1" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
