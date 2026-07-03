import { useState, useEffect } from 'react';
import { reportsAPI } from '../services/api';
import StatCard from '../components/StatCard';
import { Users, FileText, CheckCircle, DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsAPI.summary().then(res => setData(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  const chartData = (data?.monthlyDisbursements || []).map(d => ({
    month: new Date(d.month).toLocaleString('default', { month: 'short', year: '2-digit' }),
    amount: parseFloat(d.amount || 0) / 100000,
    count: parseInt(d.count || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={data?.leads?.total || 0}
          sub={`${data?.leads?.new_leads || 0} new`} icon={Users} color="blue" />
        <StatCard title="Applications This Month" value={data?.applications?.this_month || 0}
          sub={`${data?.applications?.total || 0} total`} icon={FileText} color="purple" />
        <StatCard title="Approved This Month" value={data?.applications?.approved || 0}
          sub={`${data?.applications?.rejected || 0} rejected`} icon={CheckCircle} color="green" />
        <StatCard title="Total Disbursed" value={fmt(data?.accounts?.total_disbursed)}
          sub={`${data?.accounts?.total || 0} accounts`} icon={DollarSign} color="blue" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <StatCard title="Outstanding Portfolio" value={fmt(data?.accounts?.total_outstanding)}
          sub="Across all active accounts" icon={TrendingUp} color="blue" />
        <StatCard title="Overdue EMIs" value={data?.overdue?.accounts || 0}
          sub={`${fmt(data?.overdue?.amount)} overdue`} icon={AlertTriangle} color="red" />
        <StatCard title="Disbursements" value={data?.applications?.disbursed || 0}
          sub="Loans disbursed to date" icon={CheckCircle} color="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Monthly Disbursements (₹ Lakhs)</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}L`} />
                <Tooltip formatter={(v) => [`₹${(v).toFixed(1)}L`, 'Amount']} />
                <Bar dataKey="amount" fill="#2563eb" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Application Pipeline</h3>
          <ApplicationFunnel />
        </div>
      </div>
    </div>
  );
}

function ApplicationFunnel() {
  const [data, setData] = useState([]);
  useEffect(() => {
    reportsAPI.funnel().then(r => setData(r.data.funnel || [])).catch(() => {});
  }, []);

  const colors = {
    'Draft': 'bg-slate-200 text-slate-700',
    'Submitted': 'bg-blue-100 text-blue-700',
    'Under Review': 'bg-amber-100 text-amber-700',
    'Credit Check': 'bg-purple-100 text-purple-700',
    'Approved': 'bg-green-100 text-green-700',
    'Rejected': 'bg-red-100 text-red-700',
    'Disbursed': 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-2">
      {data.map(row => (
        <div key={row.status} className="flex items-center justify-between">
          <span className={`badge ${colors[row.status] || 'bg-slate-100 text-slate-600'}`}>{row.status}</span>
          <span className="text-sm font-semibold text-slate-800">{row.count}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-slate-400">No applications yet</p>}
    </div>
  );
}
