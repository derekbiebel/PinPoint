import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { canAffordRefresh, getRefreshesLeft, COST_PER_REFRESH, MONTHLY_BUDGET, hasValidKey, setApiKey } from '../lib/oddsApi';
import SportFilter from './SportFilter';
import LastRefreshed from './LastRefreshed';
import GameCard from './GameCard';
import BetTracker from './BetTracker';

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ApiKeyScreen({ onSave }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed || trimmed === 'your_key_here') {
      setError('Please enter a valid API key.');
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 max-w-md w-full shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
          Value Finder
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 text-center">
          Enter your Odds API key to get started.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(null); }}
              placeholder="Paste your API key here"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-xs mt-1.5">{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
          >
            Connect
          </button>
        </form>
        <p className="text-gray-400 dark:text-gray-500 text-xs mt-4 text-center">
          Free key at the-odds-api.com (500 requests/month)
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const games = useStore((s) => s.games);
  const selectedSport = useStore((s) => s.selectedSport);
  const isLoading = useStore((s) => s.isLoading);
  const error = useStore((s) => s.error);
  const requestsRemaining = useStore((s) => s.requestsRemaining);
  const bets = useStore((s) => s.bets);
  const fetchGames = useStore((s) => s.fetchGames);
  const checkBudgetFn = useStore((s) => s.checkBudget);

  const affordable = canAffordRefresh(requestsRemaining);
  const refreshesLeft = getRefreshesLeft(requestsRemaining);

  const [hasKey, setHasKey] = useState(hasValidKey());

  useEffect(() => {
    if (!hasKey) return;
    // On first load, do a cheap budget check, then fetch if we can afford it
    if (games.length === 0) {
      checkBudgetFn().then(() => {
        // Re-read remaining after check — use getState for latest
        const remaining = useStore.getState().requestsRemaining;
        if (canAffordRefresh(remaining)) {
          fetchGames();
        }
      });
    }
  }, [hasKey]);

  const filtered =
    selectedSport === 'all' ? games : games.filter((g) => g.sport_key === selectedSport);

  const highValue = filtered.filter((g) => g.edgeLevel === 'high');
  const moderateValue = filtered.filter((g) => g.edgeLevel === 'moderate');
  const noEdge = filtered.filter((g) => g.edgeLevel === 'none');

  const sorted = [...highValue, ...moderateValue, ...noEdge];

  const highSpots = games.reduce(
    (n, g) => n + g.edges.filter((e) => e.edgeLevel === 'high').length,
    0
  );
  const sharpMoves = 0; // TODO: wire with historical comparison

  if (!hasKey) {
    return <ApiKeyScreen onSave={(key) => { setApiKey(key); setHasKey(true); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Value Finder</h1>
          <LastRefreshed />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Sport filter */}
        <SportFilter />

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Games Today" value={filtered.length} />
          <MetricCard label="High Value Spots" value={highSpots} sub="edge >= 5%" />
          <MetricCard
            label="API Remaining"
            value={requestsRemaining !== null ? `${requestsRemaining}/${MONTHLY_BUDGET}` : '—'}
            sub={refreshesLeft !== null ? `${refreshesLeft} refreshes left` : 'checking...'}
          />
          <MetricCard
            label="Cost Per Refresh"
            value={`~${COST_PER_REFRESH}`}
            sub="API requests"
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            {error}
            <button
              onClick={fetchGames}
              className="ml-3 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Budget warnings */}
        {!affordable && requestsRemaining !== null && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            Only {requestsRemaining} API requests remaining — not enough for a refresh. Resets next month.
          </div>
        )}
        {affordable && refreshesLeft !== null && refreshesLeft <= 5 && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
            Only {refreshesLeft} refreshes left this month. Use them wisely.
          </div>
        )}

        {/* Phantom Bankroll */}
        <BetTracker bets={bets} />

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
            <p className="text-sm">Fetching odds...</p>
          </div>
        )}

        {/* Games */}
        {!isLoading && sorted.length === 0 && games.length > 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No games found for this sport right now.</p>
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <div className="space-y-6">
            {highValue.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-green-700 dark:text-green-400 uppercase tracking-wider mb-3">
                  {"High Value \u2014 Edge \u2265 5%"}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {highValue.map((g) => <GameCard key={g.id} game={g} />)}
                </div>
              </section>
            )}

            {moderateValue.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3">
                  {"Moderate Value \u2014 Edge 3\u20135%"}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {moderateValue.map((g) => <GameCard key={g.id} game={g} />)}
                </div>
              </section>
            )}

            {noEdge.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  All Games
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {noEdge.map((g) => <GameCard key={g.id} game={g} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
