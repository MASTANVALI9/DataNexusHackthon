import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { History, Database, ArrowLeft, ShieldCheck, HardDrive, Clock, FileText } from 'lucide-react';

export default function HistoryPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 bg-slate-50">
      {/* Header */}
      <div className="space-y-3">
        <NavLink
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Verification Console</span>
        </NavLink>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1E3A8A]">
              Verification Audit History
            </h1>
            <p className="text-xs text-slate-500 font-mono font-medium">
              Audit Trail Archive &bull; TruthLens Evidence Engine
            </p>
          </div>
        </div>
      </div>

      {/* History Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 space-y-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-blue-600 flex-shrink-0 mt-0.5">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#1E3A8A]">
              Verification History Is Not Persisted
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-normal">
              Verification results are passed through the current page navigation only. TruthLens does not currently store an archive, database records, or encrypted audit trails; results are lost when the page state is cleared.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-8 space-y-5">
          <h3 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>History Persistence Status</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 shadow-xs">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Submitted Claims &amp; Text
              </span>
              <p className="text-slate-600 leading-relaxed font-normal">Submitted claims and reference URLs are not stored in a searchable archive.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 shadow-xs">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" />
                Timestamps &amp; Audit Trail
              </span>
              <p className="text-slate-600 leading-relaxed font-normal">Submission time and jurisdiction are shown on the current results view only; no cryptographic audit trail is stored.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 shadow-xs">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Verification Results &amp; Inference
              </span>
              <p className="text-slate-600 leading-relaxed font-normal">Assessment details are available in the current results view and are not retained across sessions.</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 shadow-xs">
              <span className="font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-600" />
                Evidence &amp; Source Snapshots
              </span>
              <p className="text-slate-600 leading-relaxed font-normal">Evidence URLs and excerpts are not permanently cached by the application.</p>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => navigate('/#verify-workspace')}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl btn-primary text-white font-bold text-xs shadow-md cursor-pointer"
          >
            <span>Return to Verification Console</span>
          </button>
        </div>
      </div>
    </div>
  );
}
