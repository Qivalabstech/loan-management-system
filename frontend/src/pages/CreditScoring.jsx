import { useState, useEffect } from 'react';
import { creditAPI, applicationsAPI } from '../services/api';
import { Search, Calculator } from 'lucide-react';

const RISK_COLORS = { Low: 'bg-green-100 text-green-700', Medium: 'bg-amber-100 text-amber-700', High: 'bg-red-100 text-red-700', 'Very High': 'bg-red-200 text-red-800' };
const REC_COLORS = { Approve: 'text-green-600', Decline: 'text-red-600', 'Manual Review': 'text-amber-600' };

export default function CreditScoring() {
  const [scores, setScores] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [eligibleApps, setEligibleApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [cibil, setCibil] = useState('');
  const [notes, setNotes] = useState('');
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState('');
  const [preview, setPreview] = useState(null);
  const limit = 15;

  const fetchScores = () => {
    setLoading(true);
    creditAPI.list({ page, limit })
      .then(r => { setScores(r.data.scores); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchScores(); }, [page]);

  const openModal = () => {
    applicationsAPI.list({ status: 'Credit Check', limit: 50 })
      .then(r => setEligibleApps(r.data.applications || []))
      .catch(() => {});
    setShowScoreModal(true);
    setPreview(null);
    setCibil('');
    setNotes('');
    setSelectedApp('');
    setScoreError('');
  };

  const handleScore = async () => {
    if (!selectedApp || !cibil) { setScoreError('Select an application and enter CIBIL score'); return; }
    setScoring(true);
    setScoreError('');
    try {
      const res = await creditAPI.score(selectedApp, { cibil_score: parseInt(cibil), notes });
      setPreview(res.data);
      fetchScores();
    } catch (err) {
      setScoreError(err.response?.data?.error || 'Scoring failed');
    } finally {
      setScoring(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} scores total</p>
        <button className="btn-primary" onClick={openModal}><Calculator className="w-4 h-4" /> Run Credit Score</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                {['Application','Borrower','CIBIL','DTI %','Total Score','Risk Band','Recommendation','Scored On'].map(h => (
                  <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">Loading…</td></tr>
              ) : scores.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">No scores yet</td></tr>
              ) : scores.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs text-blue-700">{s.application_number}</td>
                  <td className="px-4 py-3 font-medium">{s.full_name}</td>
                  <td className="px-4 py-3">{s.cibil_score || '—'}</td>
                  <td className="px-4 py-3">{s.dti_ratio != null ? `${s.dti_ratio}%` : '—'}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{s.total_score}/100</td>
                  <td className="px-4 py-3"><span className={`badge ${RISK_COLORS[s.risk_band] || ''}`}>{s.risk_band}</span></td>
                  <td className={`px-4 py-3 font-semibold ${REC_COLORS[s.recommendation] || ''}`}>{s.recommendation}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(s.scored_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>{total} scores</span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</button>
              <span className="px-3 py-1">{page}/{totalPages}</span>
              <button className="btn-secondary px-3 py-1" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {showScoreModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Run Credit Score</h3>
              <button className="btn-ghost p-1.5 rounded" onClick={() => setShowScoreModal(false)}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              {scoreError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{scoreError}</div>}
              <div>
                <label className="label">Application (Credit Check status)</label>
                <select className="input" value={selectedApp} onChange={e => setSelectedApp(e.target.value)}>
                  <option value="">Select application…</option>
                  {eligibleApps.map(a => (
                    <option key={a.id} value={a.id}>{a.application_number} — {a.full_name}</option>
                  ))}
                </select>
                {eligibleApps.length === 0 && <p className="text-xs text-slate-400 mt-1">No applications in Credit Check status</p>}
              </div>
              <div>
                <label className="label">CIBIL Score (300–900)</label>
                <input className="input" type="number" min={300} max={900} value={cibil} onChange={e => setCibil(e.target.value)} placeholder="e.g. 730" />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>

              {preview && (
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <p className="font-semibold text-slate-800">Score Result</p>
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-bold ${preview.calculation.totalScore >= 80 ? 'text-green-600' : preview.calculation.totalScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {preview.calculation.totalScore}/100
                    </span>
                    <div>
                      <span className={`badge ${RISK_COLORS[preview.calculation.riskBand]}`}>{preview.calculation.riskBand} Risk</span>
                      <p className={`text-sm font-semibold mt-1 ${REC_COLORS[preview.calculation.recommendation]}`}>{preview.calculation.recommendation}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded p-2"><p className="text-slate-500">DTI Ratio</p><p className="font-bold">{preview.calculation.dtiRatio}%</p></div>
                    <div className="bg-white rounded p-2"><p className="text-slate-500">Proposed EMI</p><p className="font-bold">₹{Number(preview.calculation.proposedEmi).toLocaleString('en-IN')}</p></div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button className="btn-secondary flex-1" onClick={() => setShowScoreModal(false)}>Close</button>
                <button className="btn-primary flex-1" onClick={handleScore} disabled={scoring || !selectedApp || !cibil}>
                  {scoring ? 'Scoring…' : preview ? 'Re-Score' : 'Calculate Score'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
