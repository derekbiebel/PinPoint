import { useState } from 'react';
import { getStats, clearAllBets, STAKE } from '../lib/betTracker';

function formatMoney(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function formatOdds(price) {
  return price > 0 ? `+${price}` : `${price}`;
}

const STATUS_STYLES = {
  won: 'text-green-600 dark:text-green-400',
  lost: 'text-red-500 dark:text-red-400',
  push: 'text-gray-500 dark:text-gray-400',
  pending: 'text-blue-500 dark:text-blue-400',
};

const MARKET_LABELS = { h2h: 'ML', spreads: 'SPR', totals: 'TOT' };

export default function BetTracker({ bets }) {
  const [showAll, setShowAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const stats = getStats(bets);

  const profitColor =
    stats.totalProfit > 0
      ? 'text-green-600 dark:text-green-400'
      : stats.totalProfit < 0
        ? 'text-red-500 dark:text-red-400'
        : 'text-gray-600 dark:text-gray-400';

  const recentBets = showAll ? bets : bets.slice(-20);
  const displayBets = [...recentBets].reverse();

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Phantom Bankroll
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ${STAKE} per bet, auto-placed
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-gray-100 dark:bg-gray-800">
        <div className="bg-white dark:bg-gray-900 px-4 py-3 text-center">
          <div className={`text-xl font-bold ${profitColor}`}>
            {formatMoney(stats.totalProfit)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">Net P&L</div>
        </div>
        <div className="bg-white dark:bg-gray-900 px-4 py-3 text-center">
          <div className={`text-xl font-bold ${stats.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
            {stats.roi.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500">ROI</div>
        </div>
        <div className="bg-white dark:bg-gray-900 px-4 py-3 text-center">
          <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.wins}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">Wins</div>
        </div>
        <div className="bg-white dark:bg-gray-900 px-4 py-3 text-center">
          <div className="text-xl font-bold text-red-500 dark:text-red-400">{stats.losses}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">Losses</div>
        </div>
        <div className="bg-white dark:bg-gray-900 px-4 py-3 text-center col-span-2 md:col-span-1">
          <div className="text-xl font-bold text-blue-500 dark:text-blue-400">{stats.pending}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">Pending</div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>Wagered: ${stats.totalWagered.toFixed(2)}</span>
        <span>At risk: ${stats.pendingRisk.toFixed(2)}</span>
        <span>Total bets: {stats.total}</span>
        {stats.pushes > 0 && <span>Pushes: {stats.pushes}</span>}
      </div>

      {/* Bet log */}
      {bets.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Bet Log
            </span>
            <div className="flex gap-2">
              {bets.length > 20 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showAll ? 'Show recent' : `Show all (${bets.length})`}
                </button>
              )}
              {confirmClear ? (
                <span className="flex gap-1">
                  <button
                    onClick={() => { clearAllBets(); setConfirmClear(false); window.location.reload(); }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Confirm reset
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-xs text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-gray-400 hover:text-red-500 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {displayBets.map((bet) => (
              <div
                key={bet.id}
                className="px-4 py-2 flex items-center justify-between text-xs border-t border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-semibold w-7 ${STATUS_STYLES[bet.status]}`}>
                    {bet.status === 'won' ? 'W' : bet.status === 'lost' ? 'L' : bet.status === 'push' ? 'P' : '...'}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 w-8">
                    {MARKET_LABELS[bet.market]}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 truncate">
                    {bet.market === 'totals'
                      ? `${bet.outcomeName} ${bet.point}`
                      : bet.market === 'spreads'
                        ? `${bet.outcomeName} ${bet.point > 0 ? '+' : ''}${bet.point}`
                        : bet.outcomeName}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gray-400 dark:text-gray-500 font-mono">
                    {formatOdds(bet.price)}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">
                    +{bet.edgePct.toFixed(1)}%
                  </span>
                  <span className={`font-semibold w-16 text-right ${STATUS_STYLES[bet.status]}`}>
                    {bet.status === 'pending' ? `$${bet.stake}` : formatMoney(bet.profit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {bets.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No bets placed yet. Bets are auto-placed on every value edge when you refresh.
        </div>
      )}
    </div>
  );
}
