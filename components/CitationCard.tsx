import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CitationReview } from '../types';

interface Props {
  review: CitationReview;
}

const CitationCard: React.FC<Props> = ({ review }) => {
  const [copied, setCopied] = useState(false);
  const isCorrect = review.status === 'correct';

  const handleCopy = () => {
    if (review.correction) {
      navigator.clipboard.writeText(review.correction);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`p-5 rounded-lg border-l-4 shadow-sm mb-3 bg-white transition-all ${
      isCorrect 
        ? 'border-emerald-500' 
        : 'border-rose-500'
    }`}>
      <div className="flex items-start gap-4">
        {/* Static, non-distracting emoji */}
        <div className="text-2xl opacity-90 mt-1">
          {review.emoji}
        </div>
        
        <div className="flex-1 w-full min-w-0">
          <div className="flex flex-wrap justify-between items-start mb-2 gap-2">
            {/* Status Badge */}
            <div className="flex gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded ${
                isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {isCorrect ? 'CORRECT' : 'NEEDS EDIT'}
              </span>
              
              {/* Found In Text Badge - Only relevant for Bibliography items with an author */}
              {review.primaryAuthor && (
                <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded ${
                  review.foundInText 
                    ? 'bg-sky-100 text-sky-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {review.foundInText ? `FOUND REF` : `TEXT REF MISSING?`}
                </span>
              )}
            </div>
          </div>

          {/* Original Text */}
          <div className="mb-3">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Original:</p>
            <div className={`font-mono text-sm break-words leading-relaxed ${isCorrect ? 'text-slate-700' : 'text-rose-700 line-through decoration-rose-300 opacity-80'} [&>p]:mb-0`}>
              <ReactMarkdown>{review.originalText || ''}</ReactMarkdown>
            </div>
          </div>

          {/* Correction Section */}
          {!isCorrect && review.correction && (
            <div className="mb-3 bg-slate-50 p-3 rounded border border-emerald-200 relative group">
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Correction:</p>
              <div className="font-mono text-sm text-emerald-800 font-medium break-words pr-8 leading-relaxed [&>p]:mb-0">
                <ReactMarkdown>{review.correction}</ReactMarkdown>
              </div>
              
              <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
                title="Copy correct citation"
              >
                {copied ? (
                   <span className="text-xs font-bold">✓</span>
                ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                   </svg>
                )}
              </button>
            </div>
          )}

          {/* Feedback from AI */}
          <div className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-3 [&>p]:mb-0">
            <ReactMarkdown>{review.feedback}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitationCard;