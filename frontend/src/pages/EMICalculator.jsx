import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function calcEMI(principal, annualRate, months) {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

function buildSchedule(principal, annualRate, months) {
  const r = annualRate / 12 / 100;
  const emi = calcEMI(principal, annualRate, months);
  const schedule = [];
  let balance = principal;
  const start = new Date();
  start.setMonth(start.getMonth() + 1);

  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    const principalComp = Math.min(emi - interest, balance);
    balance = Math.max(0, balance - principalComp);
    const date = new Date(start);
    date.setMonth(start.getMonth() + (i - 1));
    schedule.push({ no: i, date: date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), principal: principalComp, interest, emi, balance });
  }
  return { emi, schedule };
}

export default function EMICalculator() {
  const [principal, setPrincipal] = useState('500000');
  const [rate, setRate] = useState('12');
  const [tenure, setTenure] = useState('24');
  const [showSchedule, setShowSchedule] = useState(false);

  const result = useMemo(() => {
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const t = parseInt(tenure);
    if (!p || !r || !t || p <= 0 || r <= 0 || t <= 0) return null;
    const { emi, schedule } = buildSchedule(p, r, t);
    return { emi, totalPayment: emi * t, totalInterest: emi * t - p, schedule };
  }, [principal, rate, tenure]);

  const pct = result ? (result.totalInterest / result.totalPayment * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Calculator className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h2 className="font-semibold text-slate-800">EMI Calculator</h2>
            <p className="text-sm text-slate-500">Calculate monthly EMI and amortization schedule</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SliderInput label="Loan Amount" value={principal} onChange={setPrincipal}
            min={10000} max={10000000} step={10000} display={fmt(parseFloat(principal)||0)} />
          <SliderInput label="Interest Rate (% p.a.)" value={rate} onChange={setRate}
            min={1} max={36} step={0.25} display={`${rate}%`} />
          <SliderInput label="Tenure (months)" value={tenure} onChange={setTenure}
            min={1} max={360} step={1} display={`${tenure} mo`} />
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5 text-center">
              <p className="text-sm text-slate-500 mb-1">Monthly EMI</p>
              <p className="text-3xl font-bold text-blue-600">{fmt(result.emi)}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-slate-500 mb-1">Total Interest</p>
              <p className="text-3xl font-bold text-amber-600">{fmt(result.totalInterest)}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-slate-500 mb-1">Total Payment</p>
              <p className="text-3xl font-bold text-slate-800">{fmt(result.totalPayment)}</p>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Loan Breakdown</h3>
              <button className="btn-secondary text-sm" onClick={() => setShowSchedule(v => !v)}>
                {showSchedule ? 'Hide' : 'Show'} Amortization Schedule
              </button>
            </div>
            <div className="flex rounded-full overflow-hidden h-4 mb-3">
              <div className="bg-blue-500 transition-all" style={{ width: `${100-pct}%` }} />
              <div className="bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500" /><span>Principal {fmt(parseFloat(principal)||0)} ({(100-pct).toFixed(1)}%)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400" /><span>Interest {fmt(result.totalInterest)} ({pct.toFixed(1)}%)</span></div>
            </div>
          </div>

          {showSchedule && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="table-head sticky top-0">
                    <tr>
                      {['#','Month','Principal','Interest','EMI','Balance'].map(h => (
                        <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.schedule.map(row => (
                      <tr key={row.no} className="table-row">
                        <td className="px-4 py-2 text-slate-400">{row.no}</td>
                        <td className="px-4 py-2 text-slate-600">{row.date}</td>
                        <td className="px-4 py-2">{fmt(row.principal)}</td>
                        <td className="px-4 py-2 text-amber-600">{fmt(row.interest)}</td>
                        <td className="px-4 py-2 font-medium">{fmt(row.emi)}</td>
                        <td className="px-4 py-2 text-slate-600">{fmt(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SliderInput({ label, value, onChange, min, max, step, display }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="label mb-0">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(e.target.value)}
        className="w-full accent-blue-600 cursor-pointer" />
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="input mt-2 text-sm" min={min} max={max} />
    </div>
  );
}
