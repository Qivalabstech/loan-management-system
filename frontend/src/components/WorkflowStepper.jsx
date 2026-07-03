import { Check } from 'lucide-react';

const STAGES = ['Draft','Submitted','Under Review','Credit Check','Approved','Disbursed'];

export default function WorkflowStepper({ currentStatus }) {
  const isRejected = currentStatus === 'Rejected';
  const currentIdx = STAGES.indexOf(currentStatus);

  return (
    <div className="card p-4 mb-6">
      {isRejected ? (
        <div className="flex items-center gap-2 text-red-600">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-xs font-bold">✕</span>
          </div>
          <span className="font-semibold">Application Rejected</span>
        </div>
      ) : (
        <div className="flex items-center">
          {STAGES.map((stage, idx) => (
            <div key={stage} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                  ${idx < currentIdx ? 'bg-blue-600 border-blue-600 text-white' : ''}
                  ${idx === currentIdx ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100' : ''}
                  ${idx > currentIdx ? 'bg-white border-slate-300 text-slate-400' : ''}
                `}>
                  {idx < currentIdx ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-xs mt-1 whitespace-nowrap font-medium ${
                  idx <= currentIdx ? 'text-blue-700' : 'text-slate-400'
                }`}>
                  {stage}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 mb-5 ${idx < currentIdx ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
