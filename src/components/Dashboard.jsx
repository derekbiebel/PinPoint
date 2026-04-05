import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { canAffordRefresh, getRefreshesLeft, COST_PER_REFRESH, MONTHLY_BUDGET, hasValidKey, setApiKey, getApiKey } from '../lib/oddsApi';
import SportFilter from './SportFilter';
import LastRefreshed from './LastRefreshed';
import GameCard from './GameCard';
import BetTracker from './BetTracker';
import Settings from './Settings';
import ModelInsights from './ModelInsights';
import TrendingTeams from './TrendingTeams';

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
          PinPoint
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('games');
  const teamStats = useStore((s) => s.teamStats);

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
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">PinPoint</h1>
          <div className="flex items-center gap-2">
            <LastRefreshed />
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
          {[
            { key: 'games', label: 'Games' },
            { key: 'trending', label: 'Trending' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'trending' && <TrendingTeams teamStats={teamStats} />}

        {activeTab === 'games' && <>
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

        {/* Model Health */}
        <ModelInsights bets={bets} />

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
        </>}
      </main>

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onKeyChange={() => {
          setSettingsOpen(false);
          setHasKey(hasValidKey());
          if (hasValidKey()) window.location.reload();
        }}
      />
    </div>
  );
}
