import React, { useState } from 'react';
import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { 
  Activity, 
  ArrowLeft, 
  ShieldAlert, 
  FileText, 
  ExternalLink, 
  MapPin, 
  Globe, 
  Layers, 
  Search, 
  Clock, 
  AlertCircle,
  HelpCircle,
  Compass,
  FileCheck,
  RotateCcw,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Newspaper,
  Check,
  HelpCircle as QuestionIcon,
  Layers as HierarchyIcon
} from 'lucide-react';
import EvidenceCard from '../components/EvidenceCard';
import EvidenceScoreGauge from '../components/EvidenceScoreGauge';
import VerificationPipelineModal from '../components/VerificationPipelineModal';
import { searchEvidence } from '../services/api';

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const submission = location.state || null;

  const headline = submission?.headline || null;
  const newsText = submission?.newsText || '';
  const newsUrl = submission?.newsUrl || '';
  const jurisdiction = submission?.jurisdiction || 'Central Government / India';
  const language = submission?.language || 'English';
  const submittedAt = submission?.submittedAt 
    ? new Date(submission.submittedAt).toLocaleString() 
    : null;

  const [data, setData] = useState(submission || {});
  const [evidenceItems, setEvidenceItems] = useState(submission?.evidenceResults || submission?.results || []);
  const [evidenceTotal, setEvidenceTotal] = useState(submission?.evidenceTotal || submission?.total_found || 0);
  const [evidenceCount, setEvidenceCount] = useState(submission?.evidenceCount || submission?.results_count || 0);
  const [providerTookMs, setProviderTookMs] = useState(submission?.providerTookMs || submission?.took_ms || null);
  const [evidenceError, setEvidenceError] = useState(submission?.evidenceError || null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const jurisdictionSourcesMap = {
    'Central Government / India': [
      { name: 'Press Information Bureau (PIB)', url: 'https://pib.gov.in', type: 'Official Bureau' },
      { name: 'The Gazette of India', url: 'https://egazette.gov.in', type: 'Official Gazette' },
      { name: 'National Portal of India', url: 'https://india.gov.in', type: 'Central Portal' },
    ],
    'Andhra Pradesh': [
      { name: 'Information & Public Relations (GoAP)', url: 'https://ipr.ap.gov.in', type: 'State Bureau' },
      { name: 'Government of Andhra Pradesh Portal', url: 'https://ap.gov.in', type: 'State Portal' },
    ],
    'Telangana': [
      { name: 'Digital Media Wing (GoTS)', url: 'https://digitalmedia.telangana.gov.in', type: 'State Bureau' },
      { name: 'Government of Telangana Portal', url: 'https://telangana.gov.in', type: 'State Portal' },
    ],
    'Tamil Nadu': [
      { name: 'DIPR Tamil Nadu', url: 'https://dipr.tn.gov.in', type: 'State Bureau' },
      { name: 'Government of Tamil Nadu Portal', url: 'https://tn.gov.in', type: 'State Portal' },
    ],
    'Andaman & Nicobar Islands': [
      { name: 'Andaman & Nicobar Administration', url: 'https://andaman.gov.in', type: 'UT Portal' },
    ],
    'Jammu & Kashmir': [
      { name: 'DIPR Jammu & Kashmir', url: 'https://dipr.jk.gov.in', type: 'UT Bureau' },
    ],
  };

  const relevantSources = jurisdictionSourcesMap[jurisdiction] || jurisdictionSourcesMap['Central Government / India'];

  const handleRefreshEvidence = async () => {
    if (!headline || isRefreshing) return;
    setIsRefreshing(true);
    setEvidenceError(null);

    const langCode = language.toLowerCase().includes('telugu') ? 'te' : language.toLowerCase().includes('tamil') ? 'ta' : 'en';

    const result = await searchEvidence({
      claim: headline,
      jurisdiction,
      language: langCode,
      country: 'IN',
      size: 15,
    });

    setIsRefreshing(false);
    if (result.success) {
      setData(result.data);
      setEvidenceItems(result.data.results || []);
      setEvidenceTotal(result.data.total_found || 0);
      setEvidenceCount(result.data.results_count || 0);
      setProviderTookMs(result.data.took_ms);
      setEvidenceError(null);
    } else {
      setEvidenceError(result.error);
    }
  };

  if (!headline) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 sm:p-14 text-center space-y-6 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Activity className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="text-2xl font-extrabold text-[#1E3A8A]">
              No Claim Submitted for Verification
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Submit a headline or article URL through the verification console to generate a structured evidence evaluation.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => navigate('/#verify-workspace')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl btn-primary text-white font-bold text-xs shadow-md cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Go to Verification Console</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const verdict = data.verdict || submission?.verdict || 'INSUFFICIENT';
  const verdictLabel = data.verdict_label || submission?.verdict_label || 'INFORMATION CANNOT BE VERIFIED';
  const evidenceScore = data.evidence_score !== undefined ? data.evidence_score : submission?.evidence_score;
  const evidenceStrength = data.evidence_strength || submission?.evidence_strength || 'Insufficient Evidence';
  const summary = data.summary || submission?.summary || 'Reliable evidence was not sufficient to determine whether this statement is correct.';
  const scoreFactors = data.score_factors || submission?.score_factors || [];
  const facts = data.facts || submission?.facts || [];
  const misleadingBreakdown = data.misleading_breakdown || submission?.misleading_breakdown || null;
  const officialSources = data.official_sources || submission?.official_sources || [];
  const trustedNewsSources = data.trusted_news_sources || submission?.trusted_news_sources || [];
  const factChecks = data.fact_checks || submission?.fact_checks || [];
  const claimBreakdown = data.claim_breakdown || submission?.claim_breakdown || [];
  const evidenceMatrix = data.evidence_matrix || submission?.evidence_matrix || [];
  const providerSearchFailed = submission?.status === 'Provider Error' && Boolean(evidenceError);

  // Verdict Theme Styles using user's explicit colors
  let verdictStyle = {
    bg: 'bg-[#F1F5F9] border-[#CBD5E1] text-[#334155]',
    badge: 'bg-[#E2E8F0] text-[#334155] border-[#CBD5E1]',
    icon: QuestionIcon,
    iconColor: 'text-[#334155]',
    headingColor: 'text-[#1E293B]',
    primaryText: '? INSUFFICIENT EVIDENCE',
  };

  if (verdict === 'SUPPORTED') {
    verdictStyle = {
      bg: 'bg-[#DCFCE7] border-[#86EFAC] text-[#166534]',
      badge: 'bg-[#BBF7D0] text-[#166534] border-[#86EFAC]',
      icon: CheckCircle2,
      iconColor: 'text-[#166534]',
      headingColor: 'text-[#166534]',
      primaryText: '✓ INFORMATION APPEARS CORRECT',
    };
  } else if (verdict === 'CONTRADICTED') {
    verdictStyle = {
      bg: 'bg-[#FEE2E2] border-[#FCA5A5] text-[#991B1B]',
      badge: 'bg-[#FECDD3] text-[#991B1B] border-[#FCA5A5]',
      icon: XCircle,
      iconColor: 'text-[#991B1B]',
      headingColor: 'text-[#991B1B]',
      primaryText: '✕ INFORMATION IS INCORRECT',
    };
  } else if (verdict === 'MISLEADING') {
    verdictStyle = {
      bg: 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]',
      badge: 'bg-[#FDE68A] text-[#92400E] border-[#FCD34D]',
      icon: AlertTriangle,
      iconColor: 'text-[#92400E]',
      headingColor: 'text-[#92400E]',
      primaryText: '⚠ INFORMATION IS MISLEADING',
    };
  }

  const VerdictIcon = verdictStyle.icon;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 bg-slate-50">
      <VerificationPipelineModal isOpen={isRefreshing} claim={headline} jurisdiction={jurisdiction} />

      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <NavLink
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Verification Console</span>
          </NavLink>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1E3A8A] flex items-center gap-3">
            <Activity className="w-7 h-7 text-blue-600" />
            <span>VERIFICATION RESULT</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshEvidence}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 disabled:opacity-50 text-xs font-bold text-slate-700 cursor-pointer shadow-sm"
            title="Re-run evidence search"
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{isRefreshing ? 'Re-evaluating...' : 'Refresh Evidence'}</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl btn-primary text-xs font-bold text-white cursor-pointer shadow-sm"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Check Another Claim</span>
          </button>
        </div>
      </div>

      {evidenceError && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <strong>{providerSearchFailed ? 'Verification search failed. No verdict was produced.' : 'Evidence refresh failed.'}</strong>
          <span className="block mt-1">{evidenceError}</span>
        </div>
      )}

      {/* ================================================== */}
      {/* 1. MAIN VERIFICATION RESULT & SCORE HEADER BLOCK   */}
      {/* ================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Primary Verdict Card (2 Cols) */}
        <div className={`lg:col-span-2 rounded-3xl border p-7 sm:p-9 space-y-6 shadow-sm flex flex-col justify-between ${verdictStyle.bg}`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-mono font-extrabold tracking-widest uppercase opacity-80">
                Primary Verdict Assessment
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${verdictStyle.badge}`}>
                {jurisdiction}
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className={`p-3.5 rounded-2xl bg-white/80 border border-current ${verdictStyle.iconColor} flex-shrink-0 mt-1 shadow-sm`}>
                <VerdictIcon className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h2 className={`text-2xl sm:text-4xl font-black tracking-tight ${verdictStyle.headingColor}`}>
                  {providerSearchFailed ? '⚠ VERIFICATION SEARCH FAILED' : verdictStyle.primaryText}
                </h2>
                <p className="text-xs font-mono font-semibold opacity-90">
                  Verdict Code: <span className="font-bold">{providerSearchFailed ? 'NOT ASSESSED' : verdict}</span> &bull; Status: {providerSearchFailed ? 'Provider Error' : verdictLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Factual Summary Card */}
          <div className="p-4 rounded-2xl bg-white/90 border border-current/20 space-y-1.5 shadow-sm">
            <span className="text-xs font-bold block flex items-center gap-2 uppercase tracking-wider">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Assessment Summary</span>
            </span>
            <p className="text-xs sm:text-sm leading-relaxed font-medium">
              {providerSearchFailed ? 'Verification could not be assessed because the evidence search did not complete.' : summary}
            </p>
          </div>
        </div>

        {/* 2. EVIDENCE SUPPORT SCORE GAUGE */}
        <EvidenceScoreGauge
          score={evidenceScore}
          strength={providerSearchFailed ? 'Search did not complete' : evidenceStrength}
          scoreFactors={scoreFactors}
          unavailableReason={providerSearchFailed ? 'Search failed' : 'Insufficient'}
        />
      </div>

      {/* Submitted Claim Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Submitted Statement</span>
          </h2>
          {submittedAt && (
            <span className="text-[11px] font-mono text-slate-500">
              Submitted: {submittedAt}
            </span>
          )}
        </div>
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 leading-relaxed">
          "{headline}"
        </div>

        {/* Display Captured Image if present */}
        {submission?.capturedImage && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 pt-3">
            <span className="text-xs font-bold text-[#1E3A8A] block uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-4 h-4 text-teal-600" />
              <span>Captured Camera Image Analysis</span>
            </span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <img
                src={submission.capturedImage}
                alt="Captured claim evidence"
                className="w-40 h-28 object-cover rounded-xl border border-slate-300 shadow-sm flex-shrink-0"
              />
              <div className="space-y-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-900 block">
                  Detected Visual Media Attached
                </span>
                <p className="leading-relaxed">
                  Text extracted from this image was submitted to the configured evidence search. Any assessment depends on relevant retrieved sources shown on this page.
                </p>
                <div className="text-[11px] font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200 inline-block">
                  OCR Text Extracted &bull; Evidence Search
                </div>
              </div>
            </div>
          </div>
        )}

        {newsUrl && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
            <span>Reference URL:</span>
            <a
              href={newsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-mono text-xs transition-colors inline-flex items-center gap-1 break-all"
            >
              <span>{newsUrl}</span>
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            </a>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* SOURCE AUTHORITY HIERARCHY BLOCK                   */}
      {/* ================================================== */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
            <HierarchyIcon className="w-4 h-4 text-blue-600" />
            <span>SOURCE AUTHORITY HIERARCHY</span>
          </h2>
          <span className="text-[11px] font-mono text-teal-700 font-bold">Evidence Weighting Model</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5">
            <span className="font-extrabold text-blue-800 block uppercase tracking-wider text-[10px]">
              🏛 PRIMARY AUTHORITY
            </span>
            <span className="font-bold text-blue-950 block">Official Government Sources</span>
            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
              PIB, Gazette of India, Ministry notifications, State DIPR portals.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-1.5">
            <span className="font-extrabold text-teal-800 block uppercase tracking-wider text-[10px]">
              📰 INDEPENDENT CORROBORATION
            </span>
            <span className="font-bold text-teal-950 block">Reputable News Agencies</span>
            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
              Reuters, Associated Press, BBC, Al Jazeera, The Hindu.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-violet-50/70 border border-violet-200 space-y-1.5">
            <span className="font-extrabold text-violet-800 block uppercase tracking-wider text-[10px]">
              🧾 FACT CHECK
            </span>
            <span className="font-bold text-violet-950 block">Google Fact Check Tools</span>
            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
              ClaimReview repository archives from registered fact checkers.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 space-y-1.5">
            <span className="font-extrabold text-slate-800 block uppercase tracking-wider text-[10px]">
              🧠 EVIDENCE ANALYSIS
            </span>
            <span className="font-bold text-slate-900 block">Deterministic Engine</span>
            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
              Stance matching, multi-clause breakdown, and evidence support score.
            </p>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* KEY FACTS GRID CARDS SECTION                       */}
      {/* ================================================== */}
      {facts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-sm font-black text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>KEY FACTS</span>
            </h2>
            <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              {facts.length} Verified Evidence Points
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {facts.map((pt, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all flex items-start gap-4 shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5 shadow-sm">
                  0{idx + 1}
                </div>
                <div className="space-y-2 flex-grow">
                  <p className="text-xs sm:text-sm text-slate-900 font-bold leading-relaxed">
                    {pt.text}
                  </p>
                  {pt.sources && pt.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">Source:</span>
                      {pt.sources.map((src, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono text-emerald-800 font-semibold shadow-xs"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Misleading Claim Breakdown Section */}
      {verdict === 'MISLEADING' && (
        <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-3xl p-7 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#FCD34D] pb-4">
            <h2 className="text-sm font-black text-[#92400E] uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#92400E]" />
              <span>MISLEADING CLAIM BREAKDOWN</span>
            </h2>
            <span className="text-xs font-mono text-[#92400E] font-bold">Context Discrepancy</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="p-5 rounded-2xl bg-white/90 border border-[#FDE68A] space-y-2 shadow-xs">
              <span className="font-bold text-[#92400E] uppercase tracking-wider block border-b border-amber-100 pb-2">
                📌 CLAIMED
              </span>
              <p className="text-slate-900 font-medium leading-relaxed">
                {misleadingBreakdown?.claimed || headline}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/90 border border-[#FDE68A] space-y-2 shadow-xs">
              <span className="font-bold text-[#166534] uppercase tracking-wider block border-b border-amber-100 pb-2">
                ✅ SUPPORTED PART
              </span>
              <p className="text-slate-900 font-medium leading-relaxed">
                {misleadingBreakdown?.supported_part || "Certain background entities or general event context mentioned are real."}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/90 border border-[#FDE68A] space-y-2 shadow-xs">
              <span className="font-bold text-[#991B1B] uppercase tracking-wider block border-b border-amber-100 pb-2">
                ⚠️ MISLEADING PART
              </span>
              <p className="text-slate-900 font-medium leading-relaxed">
                {misleadingBreakdown?.misleading_part || "Key assertions regarding official announcements or financial figures are inaccurate."}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white/90 border border-[#FDE68A] space-y-2 shadow-xs">
              <span className="font-bold text-blue-700 uppercase tracking-wider block border-b border-amber-100 pb-2">
                💡 ACTUAL INFORMATION
              </span>
              <p className="text-slate-900 font-medium leading-relaxed">
                {misleadingBreakdown?.actual_information || "Reliable sources establish what actually occurred."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 8. OFFICIAL EVIDENCE SECTION                       */}
      {/* ================================================== */}
      <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4.5 h-4.5 text-blue-600" />
              <span>OFFICIAL EVIDENCE</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Authoritative government portals and press bureaus for {jurisdiction}
            </p>
          </div>
          <span className="text-xs font-mono text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200 font-bold">
            Official Registry Mapped
          </span>
        </div>

        {officialSources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {officialSources.map((off, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 hover:border-slate-300 transition-all shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 block">
                    {off.name}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    off.relationship === 'SUPPORTS' ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]' : 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]'
                  }`}>
                    {off.relationship}
                  </span>
                </div>
                <p className="text-xs text-slate-800 font-bold line-clamp-2">
                  {off.title}
                </p>
                {off.snippet && (
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 bg-white p-3 rounded-xl border border-slate-200 font-normal">
                    "{off.snippet}"
                  </p>
                )}
                <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-[11px]">
                  <span className="text-slate-500 font-mono font-medium">Official Authority</span>
                  <a
                    href={off.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Open Source →</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Below are the designated official reference portals for <span className="text-slate-900 font-bold">{jurisdiction}</span>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relevantSources.map((src) => (
                <div key={src.name} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs shadow-xs">
                  <span className="font-bold text-slate-900 block">{src.name}</span>
                  <span className="text-[10px] text-slate-500 block font-mono font-medium">{src.type}</span>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-bold pt-1"
                  >
                    <span>Visit Authority →</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* 7. TRUSTED NEWS SOURCES SECTION                    */}
      {/* ================================================== */}
      <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
              <Newspaper className="w-4.5 h-4.5 text-blue-600" />
              <span>TRUSTED NEWS SOURCES</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Corroborating reporting from established news organizations
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600 font-semibold">
            {trustedNewsSources.length} Articles Returned
          </span>
        </div>

        {trustedNewsSources.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {trustedNewsSources.map((news, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-700 block">
                      {news.publisher}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      news.relationship === 'SUPPORTS'
                        ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]'
                        : news.relationship === 'CONTRADICTS'
                        ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}>
                      {news.relationship === 'SUPPORTS' ? '✓ SUPPORTS' : news.relationship === 'CONTRADICTS' ? '✕ CONTRADICTS' : news.relationship}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {news.title}
                  </h3>

                  {news.snippet && (
                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-3 bg-white p-3.5 rounded-xl border border-slate-200 font-normal">
                      "{news.snippet}"
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                    {news.published_at ? new Date(news.published_at).toLocaleDateString() : 'Verified Corpus'}
                  </span>
                  <a
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors"
                  >
                    <span>Read Article →</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
            <p className="text-xs text-slate-500 font-normal">
              No direct matches from major international news partners were found in the current index for this exact claim string.
            </p>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* 9. GOOGLE FACT CHECK SECTION                       */}
      {/* ================================================== */}
      <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4.5 h-4.5 text-blue-600" />
              <span>EXISTING FACT CHECKS</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              ClaimReview repository search via Google Fact Check Tools API
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 font-semibold">
            FactCheck Index
          </span>
        </div>

        {factChecks.length > 0 ? (
          <div className="space-y-3.5">
            {factChecks.map((fc, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-blue-700">{fc.publisher}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[10px] font-bold">
                      Rating: {fc.rating}
                    </span>
                  </div>
                  <p className="text-slate-900 font-medium">"{fc.claim_reviewed}"</p>
                </div>
                {fc.url && (
                  <a
                    href={fc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-blue-700 font-bold transition-colors flex-shrink-0 shadow-xs"
                  >
                    <span>Read Fact Check →</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-slate-900 block flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span>No matching existing fact-check was found.</span>
            </span>
            <p className="text-slate-600 leading-relaxed font-normal">
              Note: The absence of a prior fact-check by independent fact-checking organizations does not mean the claim is true or false. TruthLens evaluates retrieved primary evidence directly.
            </p>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* 11. CLAIM BREAKDOWN SECTION                        */}
      {/* ================================================== */}
      {claimBreakdown.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-blue-600" />
                <span>CLAIM BREAKDOWN</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Multi-clause decomposition &amp; independent stance evaluation
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 font-semibold">
              {claimBreakdown.length} Clauses
            </span>
          </div>

          <div className="space-y-4">
            {claimBreakdown.map((cb, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-slate-600 uppercase font-mono text-[11px]">
                    Claim Clause 0{idx + 1}
                  </span>
                  <span className={`px-3 py-0.5 rounded-full font-mono font-bold border ${
                    cb.verdict === 'SUPPORTED' ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]' :
                    cb.verdict === 'CONTRADICTED' ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]' :
                    'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]'
                  }`}>
                    {cb.verdict_label} {cb.evidence_score ? `(${cb.evidence_score}/100)` : ''}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">"{cb.claim}"</p>
                {cb.key_sources && cb.key_sources.length > 0 && (
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] pt-1 border-t border-slate-200">
                    <span>Corroboration:</span>
                    <span className="text-slate-800 font-mono font-semibold">{cb.key_sources.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* 10. EVIDENCE MATRIX TABLE                          */}
      {/* ================================================== */}
      <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
              <Compass className="w-4.5 h-4.5 text-blue-600" />
              <span>EVIDENCE MATRIX</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Structured relationship &amp; authority mapping matrix
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 font-semibold">
            {evidenceMatrix.length} Rows
          </span>
        </div>

        {evidenceMatrix.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-mono text-[10px] font-bold">
                  <th className="py-3.5 px-4">Source Domain</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Relationship</th>
                  <th className="py-3.5 px-4">Relevance</th>
                  <th className="py-3.5 px-4">Evidence Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {evidenceMatrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{row.source}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 font-medium">{row.source_type}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                        row.relationship === 'SUPPORTS' ? 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]' :
                        row.relationship === 'CONTRADICTS' ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]' :
                        'bg-[#F1F5F9] text-[#334155] border-[#CBD5E1]'
                      }`}>
                        {row.relationship}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 font-medium">{row.relevance}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 transition-colors line-clamp-1 flex items-center gap-1"
                      >
                        <span>{row.title}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No evidence matrix rows generated.</p>
        )}
      </div>

      {/* Raw Evidence Cards List */}
      <div className="bg-white border border-slate-200 rounded-3xl p-7 sm:p-8 space-y-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-2">
            <FileCheck className="w-4.5 h-4.5 text-blue-600" />
            <span>Retrieved Evidence Records</span>
          </h2>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-bold">
            {evidenceItems.length} Candidates
          </span>
        </div>

        {evidenceItems.length > 0 ? (
          <div className="space-y-4">
            {evidenceItems.map((item) => (
              <EvidenceCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EvidenceCard isEmptyState={true} emptyMessage="No relevant evidence candidate articles found." />
        )}
      </div>

      {/* VERIFICATION METHODOLOGY SECTION */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200 space-y-4 text-xs text-slate-600 shadow-sm">
        <div className="flex items-center gap-2.5 text-[#1E3A8A] font-black text-sm uppercase tracking-wider">
          <ShieldAlert className="w-5 h-5 text-blue-600" />
          <span>VERIFICATION METHODOLOGY &amp; INTEGRITY GUARANTEE</span>
        </div>
        <p className="leading-relaxed font-normal">
          TruthLens evaluates user claims by comparing assertions against primary empirical evidence from official state portals, gazettes, internationally recognized news organizations, and Google Fact Check records.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 text-[11px]">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">🏛 Official Authorities</span>
            <span className="text-slate-500">Direct grounding against PIB, Gazette of India, and State DIPR portals.</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">📰 Independent Reporting</span>
            <span className="text-slate-500">Corroboration from Reuters, Associated Press, BBC, and The Hindu.</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">🧾 ClaimReview Fact Checks</span>
            <span className="text-slate-500">Structured lookup across global fact-checking organization archives.</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 block">📊 Deterministic Scoring</span>
            <span className="text-slate-500">Explainable evidence support scoring without ungrounded LLM opinion.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
