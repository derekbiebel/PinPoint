import { useState } from 'react';
import { generateInsights } from '../lib/modelFeedback';

const STATUS_COLORS = {
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  strong: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    dot: 'bg-green-500',
  },
  neutral: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    dot: 'bg-gray-400',
  },
};

function formatMoney(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function SegmentRow({ segment }) {
  const c = STATUS_COLORS[segment.status];
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${c.bg}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {segment.label}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {segment.total} bets
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {(segment.winRate * 100).toFixed(0)}% W
        </span>
        <span className={`text-xs font-semibold ${segment.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {formatMoney(segment.totalProfit)}
        </span>
      </div>
    </div>
  );
}

export default function ModelInsights({ bets }) {
  const [expanded, setExpanded] = useState(false);
  const { segments, suggestions, overall } = generateInsights(bets);

  const resolved = bets.filter((b) => b.status !== 'pending');
  if (resolved.length < 8) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Model Health
          </h2>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Need at least 8 resolved bets to start analyzing patterns. Currently have {resolved.length}.
        </p>
      </div>
    );
  }

  const dangerCount = suggestions.filter((s) => s.severity === 'danger').length;
  const warningCount = suggestions.filter((s) => s.severity === 'warning').length;

  // Sort segments: danger first, then warning, strong, neutral
  const sortOrder = { danger: 0, warning: 1, strong: 2, neutral: 3 };
  const sortedSegments = [...segments].sort(
    (a, b) => (sortOrder[a.status] ?? 3) - (sortOrder[b.status] ?? 3)
  );

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Model Health
            </h2>
            {dangerCount > 0 && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                {dangerCount} issue{dangerCount > 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                {warningCount} warning{warningCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {expanded ? 'Collapse' : 'Details'}
          </button>
        </div>
      </div>

      {/* Suggestions (always visible if any) */}
      {suggestions.length > 0 && (
        <div className="px-4 py-3 space-y-2 border-b border-gray-100 dark:border-gray-800">
          {suggestions.map((s, i) => {
            const c = STATUS_COLORS[s.severity];
            return (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${c.bg} ${c.border}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${c.dot}`} />
                <p className={`text-sm ${c.text}`}>{s.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {suggestions.length === 0 && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <span className="w-2 h-2 rounded-full shrink-0 bg-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">
              No issues detected. Model is performing within expected range.
            </p>
          </div>
        </div>
      )}

      {/* Expanded segment breakdown */}
      {expanded && (
        <div className="px-4 py-3 space-y-1.5">
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Performance by Segment
          </div>
          {sortedSegments.map((seg) => (
            <SegmentRow key={`${seg.segType}-${seg.label}`} segment={seg} />
          ))}
        </div>
      )}
    </div>
  );
}
