import { useState, useEffect, useCallback } from 'react';
import { leadsAPI } from '../services/api';
import { Plus, Search, Phone, Mail, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS = {
  New: 'bg-blue-100 text-blue-700',
  Contacted: 'bg-amber-100 text-amber-700',
  Qualified: 'bg-purple-100 text-purple-700',
  Converted: 'bg-green-100 text-green-700',
  Dropped: 'bg-red-100 text-red-700',
};

const STATUSES = ['New','Contacted','Qualified','Converted','Dropped'];
const SOURCES = ['Website','Referral','Walk-in','Campaign','Social Media','Partner'];
const LOAN_TYPES = ['Personal','Home','Business','Auto','Education','Gold','Mortgage'];

const emptyForm = { name:'', email:'', phone:'', loan_type:'Personal', loan_amount:'', source:'Website', status:'New', notes:'' };

export default function Leads() {
  const { user, hasRole } = useAuth();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const limit = 15;

  const fetchLeads = useCallback(() => {
    setLoading(true);
    leadsAPI.list({ page, limit, search: search || undefined, status: statusFilter || undefined })
      .then(res => { setLeads(res.data.leads); setTotal(res.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowModal(true); };
  const openEdit = (lead) => {
    setEditing(lead);
    setForm({ name: lead.name, email: lead.email||'', phone: lead.phone, loan_type: lead.loan_type||'Personal',
      loan_amount: lead.loan_amount||'', source: lead.source||'Website', status: lead.status, notes: lead.notes||'' });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await leadsAPI.update(editing.id, form);
      } else {
        await leadsAPI.create(form);
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this lead?')) return;
    await leadsAPI.delete(id).catch(() => {});
    fetchLeads();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input pl-9" placeholder="Search by name, phone…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="input w-40" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {hasRole('Admin','Loan Officer') && (
          <button className="btn-primary flex-shrink-0" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                {['Name','Contact','Loan Type','Amount','Source','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">No leads found</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className="table-row">
                  <td className="px-4 py-3 font-medium">{lead.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {lead.phone && <span className="flex items-center gap-1 text-slate-600"><Phone className="w-3 h-3" />{lead.phone}</span>}
                      {lead.email && <span className="flex items-center gap-1 text-slate-500 text-xs"><Mail className="w-3 h-3" />{lead.email}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{lead.loan_type || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{lead.loan_amount ? `₹${Number(lead.loan_amount).toLocaleString('en-IN')}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{lead.source}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>{lead.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {hasRole('Admin','Loan Officer') && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(lead)} className="btn-ghost p-1.5 rounded-md"><Edit2 className="w-4 h-4" /></button>
                        {hasRole('Admin') && <button onClick={() => handleDelete(lead.id)} className="btn-ghost p-1.5 rounded-md text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>{total} leads total</span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1" disabled={page === 1} onClick={() => setPage(p => p-1)}>Prev</button>
              <span className="px-3 py-1">{page}/{totalPages}</span>
              <button className="btn-secondary px-3 py-1" disabled={page === totalPages} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Lead' : 'Add Lead'}</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Full Name *</label>
                  <input className="input" required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input className="input" required value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Loan Type</label>
                  <select className="input" value={form.loan_type} onChange={e => setForm(f => ({...f, loan_type: e.target.value}))}>
                    {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Loan Amount (₹)</label>
                  <input className="input" type="number" value={form.loan_amount} onChange={e => setForm(f => ({...f, loan_amount: e.target.value}))} />
                </div>
                <div>
                  <label className="label">Source</label>
                  <select className="input" value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))}>
                    {SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input" rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Lead'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
