import React, { useState } from 'react';
import { HelpCircle, Info, ShieldCheck, X } from 'lucide-react';

export default function EvidenceScoreGauge({ score, strength, scoreFactors = [], unavailableReason = 'Insufficient' }) {
  const [showFactorsModal, setShowFactorsModal] = useState(false);

  const isInsufficient = score === null || score === undefined;
  const numericScore = isInsufficient ? 0 : Math.min(Math.max(score, 0), 100);

  let strokeColor = '#2563EB'; // blue-600
  let textColor = 'text-blue-700';
  let badgeBg = 'bg-blue-50 border-blue-200 text-blue-800';

  if (!isInsufficient) {
    if (numericScore >= 75) {
      strokeColor = '#16A34A'; // green-600
      textColor = 'text-[#166534]';
      badgeBg = 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]';
    } else if (numericScore >= 50) {
      strokeColor = '#D97706'; // amber-600
      textColor = 'text-[#92400E]';
      badgeBg = 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]';
    } else {
      strokeColor = '#DC2626'; // red-600
      textColor = 'text-[#991B1B]';
      badgeBg = 'bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]';
    }
  } else {
    strokeColor = '#94A3B8'; // slate-400
    textColor = 'text-[#334155]';
    badgeBg = 'bg-[#F1F5F9] border-[#CBD5E1] text-[#334155]';
  }

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = isInsufficient
    ? circumference
    : circumference - (numericScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-sm relative space-y-4">
      <div className="text-center space-y-1">
        <span className="text-xs font-extrabold text-[#1E3A8A] uppercase tracking-wider block">
          EVIDENCE SUPPORT SCORE
        </span>
        <p className="text-[11px] text-slate-500 max-w-xs font-medium">
          Measures evidence support, not truth probability. N/A means no reliable score can be justified.
        </p>
      </div>

      {/* Circular Donut Gauge */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="#E2E8F0"
            strokeWidth="10"
            fill="transparent"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke={strokeColor}
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {isInsufficient ? (
            <div className="space-y-0.5">
              <span className="text-xl font-black text-slate-500 block">N/A</span>
              <span className="text-[10px] text-slate-400 block font-mono font-bold">{unavailableReason}</span>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="flex items-baseline justify-center">
                <span className={`text-4xl font-black tracking-tight ${textColor}`}>
                  {numericScore}
                </span>
                <span className="text-slate-400 text-xs font-bold ml-0.5">/100</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Strength Label Badge */}
      <div className="text-center space-y-2">
        <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold border ${badgeBg}`}>
          {strength || (isInsufficient ? "Insufficient Evidence" : "Moderate Evidence")}
        </span>

        {/* Why this score button */}
        {scoreFactors && scoreFactors.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowFactorsModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Why this score?</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal for "Why this score?" */}
      {showFactorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-[#1E3A8A] font-extrabold text-sm">
                <ShieldCheck className="w-4.5 h-4.5 text-blue-600" />
                <span>Evidence Score Factors Breakdown</span>
              </div>
              <button
                onClick={() => setShowFactorsModal(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              This score represents support for the submitted claim, not its probability of being true. It uses direct evidence, source reliability, report completeness, and distinct report text. A low score can accompany reliable contradictory evidence; N/A means a numeric score is not justified.
            </p>

            <div className="space-y-3">
              {scoreFactors.map((factor, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-900">{factor.factor}</span>
                    <span className={`font-mono text-[11px] font-bold ${
                      factor.impact.includes('+') ? 'text-emerald-700' : factor.impact.includes('-') ? 'text-rose-700' : 'text-slate-600'
                    }`}>
                      {factor.impact}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed font-normal">
                    {factor.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowFactorsModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
