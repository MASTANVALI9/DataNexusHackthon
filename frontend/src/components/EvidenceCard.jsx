import React from 'react';
import { ExternalLink, Calendar, AlertCircle, Newspaper } from 'lucide-react';

export default function EvidenceCard({
  item,
  sourceName,
  sourceType,
  articleTitle,
  url,
  publicationDate,
  description,
  explanation,
  provider,
  language,
  country,
  isEmptyState = false,
  emptyMessage,
}) {
  const finalTitle = item?.title || articleTitle || 'Untitled Evidence Candidate';
  const finalPublisher = item?.publisher || sourceName || 'News Publisher';
  const finalUrl = item?.source_url || item?.url || url;
  const rawDate = item?.published_at || item?.publicationDate || publicationDate;
  const finalDate = rawDate ? new Date(rawDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) : null;
  const finalDescription = item?.description || description || explanation;
  const finalSourceType = item?.source_type || sourceType || 'news';
  const finalProvider = item?.provider || provider || 'free_news_api';
  const finalLang = item?.language || language;
  const finalCountry = item?.country || country;

  if (isEmptyState) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center space-y-3">
        <div className="w-10 h-10 mx-auto rounded-full bg-slate-200/80 border border-slate-300 flex items-center justify-center text-slate-500">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800">
            {emptyMessage || 'No Relevant Evidence Sources Found'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-normal">
            No matching news articles or reports were indexed for this query within the rolling 30-day window. Absence of retrieved news articles does not mean the claim is false.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 hover:border-slate-300 transition-all shadow-sm">
      {/* Header: Publisher Name, Source Type, Provider */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-extrabold text-slate-900">
              {finalPublisher}
            </span>
            <span className="ml-2 text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {finalSourceType}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {finalCountry && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {finalCountry}
            </span>
          )}
          {finalLang && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
              {finalLang}
            </span>
          )}
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
            {finalProvider === 'free_news_api' ? 'Free News API' : finalProvider}
          </span>
        </div>
      </div>

      {/* Title & URL */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
          {finalTitle}
        </h4>

        {finalUrl ? (
          <a
            href={finalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors break-all group"
          >
            <span className="group-hover:underline">{finalUrl}</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
          </a>
        ) : (
          <span className="text-xs text-slate-400 italic">No external URL available</span>
        )}
      </div>

      {/* Description Snippet */}
      {finalDescription && (
        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5 leading-relaxed font-normal">
          <span className="font-bold text-slate-500 block mb-1 uppercase tracking-wider text-[10px]">Article Excerpt:</span>
          "{finalDescription}"
        </div>
      )}

      {/* Footer Date */}
      {finalDate && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono font-medium pt-1 border-t border-slate-100">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Published: {finalDate}</span>
        </div>
      )}
    </div>
  );
}
