function formatOdds(price) {
  return price > 0 ? `+${price}` : `${price}`;
}

function EdgeBadge({ edgeLevel, edgePct }) {
  if (edgeLevel === 'none') return null;

  const styles =
    edgeLevel === 'high'
      ? 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200'
      : 'bg-amber-50 text-amber-800 dark:bg-amber-900 dark:text-amber-200';

  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${styles}`}>
      +{edgePct.toFixed(1)}%
    </span>
  );
}

const FACTOR_COLORS = {
  positive: 'text-green-600 dark:text-green-400',
  negative: 'text-red-500 dark:text-red-400',
  neutral: 'text-gray-500 dark:text-gray-400',
};

export default function BetBlock({ edge }) {
  const label =
    edge.market === 'h2h'
      ? edge.outcomeName
      : edge.market === 'spreads'
        ? `${edge.outcomeName} ${edge.point > 0 ? '+' : ''}${edge.point}`
        : `${edge.outcomeName} ${edge.point}`;

  const hasFactors = edge.confidenceFactors && edge.confidenceFactors.length > 0;

  return (
    <div className="py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
            {formatOdds(edge.price)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 w-14 text-right" title="FanDuel implied">
            FD {(edge.impliedProb * 100).toFixed(0)}%
          </span>
          {edge.modelProb !== null && (
            <span className="text-xs text-indigo-600 dark:text-indigo-400 w-14 text-right font-medium" title="Our model estimate">
              PP {(edge.modelProb * 100).toFixed(0)}%
            </span>
          )}
          <EdgeBadge edgeLevel={edge.edgeLevel} edgePct={edge.edgePct} />
        </div>
      </div>
      {hasFactors && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 ml-0.5">
          {edge.confidenceFactors.map((f, i) => (
            <span key={i} className={`text-xs ${FACTOR_COLORS[f.impact]}`}>
              {f.label}: {f.detail}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
