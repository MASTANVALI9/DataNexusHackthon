import React from 'react';
import { ShieldCheck, MapPin, Globe, Terminal } from 'lucide-react';

export default function Footer() {
  const jurisdictions = [
    'Central Government / India',
    'Andhra Pradesh',
    'Telangana',
    'Tamil Nadu',
    'Andaman & Nicobar',
    'Jammu & Kashmir',
  ];

  const languages = ['English', 'Telugu (తెలుగు)', 'Tamil (தமிழ்)'];

  return (
    <footer className="border-t border-slate-200 bg-white mt-auto text-slate-600 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Mission & Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-[#1E3A8A] font-extrabold text-lg">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <span>TruthLens</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Evidence-based news and claim verification. Validating public assertions against official gazettes, press bureaus, and authoritative public records.
            </p>
            <p className="text-xs font-mono font-bold text-blue-600">
              "Evidence before belief."
            </p>
          </div>

          {/* Jurisdictions Scope */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Priority Indian Jurisdictions</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {jurisdictions.map((item) => (
                <span
                  key={item}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Supported Languages & System Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E3A8A] uppercase tracking-wider">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Language Prioritization</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold"
                >
                  {lang}
                </span>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-[11px] text-teal-700 font-mono font-bold">
                <Terminal className="w-3.5 h-3.5 text-teal-600" />
                <span>TruthLens Evidence Engine &bull; Active</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-normal">
                Queries Google Fact Check Tools, Free News API, and Indian Government Gazettes.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} TruthLens Platform. Evidence-based news and claim verification.
          </div>
          <div className="font-mono text-[11px] text-slate-500 font-medium">
            FastAPI Backend &bull; React / Vite / Tailwind Frontend
          </div>
        </div>
      </div>
    </footer>
  );
}
