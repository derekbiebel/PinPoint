function formatOdds(price) {
  return price > 0 ? `+${price}` : `${price}`;
}

function MovementIndicator({ movement }) {
  if (!movement) return null;
  const arrow = movement.direction === 'up' ? '\u2191' : '\u2193';
  const color = movement.direction === 'up' ? 'text-green-600' : 'text-red-500';
  return (
    <span className={`text-xs font-medium ${color}`} title={`Moved ${movement.magnitude.toFixed(1)}`}>
      {arrow}
    </span>
  );
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

export default function BetBlock({ edge, movement }) {
  const label =
    edge.market === 'h2h'
      ? edge.outcomeName
      : edge.market === 'spreads'
        ? `${edge.outcomeName} ${edge.point > 0 ? '+' : ''}${edge.point}`
        : `${edge.outcomeName} ${edge.point}`;

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {label}
        </span>
        <MovementIndicator movement={movement} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
          {formatOdds(edge.price)}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500 w-12 text-right">
          {(edge.impliedProb * 100).toFixed(1)}%
        </span>
        <EdgeBadge edgeLevel={edge.edgeLevel} edgePct={edge.edgePct} />
        <span className="text-xs text-gray-400 dark:text-gray-500 w-16 text-right">
          {edge.bookTitle}
        </span>
      </div>
    </div>
  );
}
