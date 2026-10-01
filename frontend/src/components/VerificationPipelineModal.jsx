import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Globe, 
  FileCheck, 
  Building2, 
  Newspaper, 
  GitCompare, 
  BarChart3, 
  CheckCircle2,
  Loader2 
} from 'lucide-react';

const PIPELINE_STEPS = [
  { id: 1, label: 'Extracting core claim & entities', icon: Search },
  { id: 2, label: 'Detecting jurisdiction & language filters', icon: Globe },
  { id: 3, label: 'Checking existing fact-checks (ClaimReview)', icon: FileCheck },
  { id: 4, label: 'Querying official government registries', icon: Building2 },
  { id: 5, label: 'Searching trusted news search index', icon: Newspaper },
  { id: 6, label: 'Comparing evidence & NLI inference', icon: GitCompare },
  { id: 7, label: 'Calculating evidence support score', icon: BarChart3 },
];

export default function VerificationPipelineModal({ isOpen, claim, jurisdiction }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < PIPELINE_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        {/* Header Bar Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500" />

        <div className="text-center space-y-2 pt-1">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono font-bold">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>VERIFICATION PIPELINE</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1E3A8A] tracking-tight">
            Verifying Claim Against Evidence
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto line-clamp-2 italic font-medium">
            "{claim}"
          </p>
        </div>

        {/* Steps List */}
        <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 text-xs transition-all duration-300 ${
                  isCurrent
                    ? 'text-blue-900 font-bold translate-x-1'
                    : isCompleted
                    ? 'text-slate-600 font-semibold'
                    : 'text-slate-400 font-normal'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : isCurrent
                    ? 'bg-blue-100 text-blue-700 border border-blue-300 animate-pulse'
                    : 'bg-slate-200 text-slate-400 border border-slate-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                </div>

                <span className="flex-grow">{step.label}</span>

                {isCompleted && (
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    DONE
                  </span>
                )}
                {isCurrent && (
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 animate-pulse">
                    RUNNING...
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center text-[11px] text-slate-500 font-mono">
          Jurisdiction: <span className="text-slate-800 font-semibold">{jurisdiction || 'Central Government / India'}</span>
        </div>
      </div>
    </div>
  );
}
