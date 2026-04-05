import BetBlock from './BetBlock';
import SharpMoneyBar from './SharpMoneyBar';

const SPORT_BADGES = {
  americanfootball_nfl: { label: 'NFL', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  basketball_nba: { label: 'NBA', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  baseball_mlb: { label: 'MLB', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  icehockey_nhl: { label: 'NHL', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' },
};

const MARKET_LABELS = { h2h: 'Moneyline', spreads: 'Spread', totals: 'Total' };

function accentColor(edgeLevel) {
  if (edgeLevel === 'high') return 'border-l-green-500';
  if (edgeLevel === 'moderate') return 'border-l-amber-400';
  return 'border-l-transparent';
}

export default function GameCard({ game }) {
  const badge = SPORT_BADGES[game.sport_key] || { label: game.sport_title, color: 'bg-gray-100 text-gray-800' };
  const gameTime = new Date(game.commence_time).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const edgesByMarket = {};
  for (const edge of game.edges) {
    if (!edgesByMarket[edge.market]) edgesByMarket[edge.market] = [];
    edgesByMarket[edge.market].push(edge);
  }

  // For each market, show only the best edge per outcome (keyed by name only)
  const bestEdgesByMarket = {};
  for (const [market, edges] of Object.entries(edgesByMarket)) {
    const byOutcome = {};
    for (const e of edges) {
      const key = e.outcomeName;
      if (!byOutcome[key] || e.edgePct > byOutcome[key].edgePct) {
        byOutcome[key] = e;
      }
    }
    bestEdgesByMarket[market] = Object.values(byOutcome);
  }

  const movementCount = 0; // TODO: wire up with historical data

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm border-l-4 ${accentColor(game.edgeLevel)} overflow-hidden`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
              {badge.label}
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {game.away_team} @ {game.home_team}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500 dark:text-gray-400">
            <span>{gameTime}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>FanDuel</span>
          </div>
        </div>
      </div>

      {/* Markets */}
      <div className="px-4 py-3 space-y-3">
        {['h2h', 'spreads', 'totals'].map((marketKey) => {
          const edges = bestEdgesByMarket[marketKey];
          if (!edges || edges.length === 0) return null;
          return (
            <div key={marketKey}>
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                {MARKET_LABELS[marketKey]}
              </div>
              <div className="space-y-0.5">
                {edges.map((edge, i) => (
                  <BetBlock key={i} edge={edge} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3">
        <SharpMoneyBar />
      </div>
    </div>
  );
}
