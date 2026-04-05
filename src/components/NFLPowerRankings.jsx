import { useState, useEffect, useCallback } from 'react';
import {
  fetchTeamRatings,
  fetchGames,
  fetchFutures,
  fetchMatchups,
  fetchPlayers,
  fetchStatus,
} from '../lib/nflApi';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function espnLogo(abbrev) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbrev.toLowerCase()}.png`;
}

const TEAM_NAMES = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens',
  BUF: 'Buffalo Bills', CAR: 'Carolina Panthers', CHI: 'Chicago Bears',
  CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns', DAL: 'Dallas Cowboys',
  DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs', LAC: 'LA Chargers', LAR: 'LA Rams',
  LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins', MIN: 'Minnesota Vikings',
  NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers',
  SEA: 'Seattle Seahawks', SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
};

function tierColor(rank) {
  if (rank <= 8) return 'text-green-600 dark:text-green-400';
  if (rank >= 25) return 'text-red-500 dark:text-red-400';
  return 'text-gray-700 dark:text-gray-300';
}

function tierBg(rank) {
  if (rank <= 8) return 'bg-green-50 dark:bg-green-900/20';
  if (rank >= 25) return 'bg-red-50 dark:bg-red-900/20';
  return '';
}

function edgeBadge(tier) {
  if (tier === 'strong') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (tier === 'lean') return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backend-not-running screen
// ---------------------------------------------------------------------------

function BackendOffline({ onCheck }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      await fetchStatus();
      setResult('connected');
    } catch {
      setResult('failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 max-w-lg mx-auto shadow-sm text-center space-y-5">
      <div className="text-4xl">🏈</div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        NFL Power Rankings requires the Python backend
      </h3>
      <ol className="text-left text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
        <li>Install Python 3.10+</li>
        <li>
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
            cd pinpoint/backend
          </code>
        </li>
        <li>
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
            pip install -r requirements.txt
          </code>
        </li>
        <li>
          <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">
            python main.py
          </code>
        </li>
        <li>Come back and refresh</li>
      </ol>

      <button
        onClick={() => { handleCheck(); onCheck?.(); }}
        disabled={checking}
        className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {checking ? 'Checking...' : 'Check Connection'}
      </button>

      {result === 'connected' && (
        <p className="text-green-600 dark:text-green-400 text-sm font-medium">
          Backend is running! Refresh the page to load data.
        </p>
      )}
      {result === 'failed' && (
        <p className="text-red-500 dark:text-red-400 text-sm">
          Could not reach backend at localhost:8000. Make sure it is running.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: generic data fetcher with backend-offline detection
// ---------------------------------------------------------------------------

function useNflData(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOffline(false);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      // Network errors (CORS, connection refused, etc.) indicate backend is offline
      if (err instanceof TypeError || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch')) {
        setOffline(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, offline, reload: load };
}

// ---------------------------------------------------------------------------
// Sub-view: Rankings
// ---------------------------------------------------------------------------

function RankingsView() {
  const { data: teams, loading, error, offline, reload } = useNflData(fetchTeamRatings);

  if (offline) return <BackendOffline onCheck={reload} />;
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!teams || teams.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">
        No team ratings available yet.
      </p>
    );
  }

  // Normalize API fields to what the UI expects
  const normalized = teams.map((t) => ({
    abbrev: t.abbrev || t.team,
    name: t.name || TEAM_NAMES[t.team] || t.team,
    offense: t.offense ?? t.off_epa ?? 0,
    defense: t.defense ?? t.def_epa ?? 0,
    composite: t.composite ?? t.composite_rating ?? 0,
    trend: t.trend ?? 0,
  }));

  const sorted = [...normalized].sort((a, b) => b.composite - a.composite);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[3rem_2.5rem_1fr_4.5rem_4.5rem_5rem_3rem] gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        <span>#</span>
        <span />
        <span>Team</span>
        <span className="text-right">OFF</span>
        <span className="text-right">DEF</span>
        <span className="text-right">Rating</span>
        <span className="text-center">Trend</span>
      </div>

      {sorted.map((team, idx) => {
        const rank = idx + 1;
        const trend = team.trend ?? 0;
        return (
          <div
            key={team.abbrev}
            className={`grid grid-cols-[3rem_2.5rem_1fr_4.5rem_4.5rem_5rem_3rem] gap-2 px-4 py-2.5 items-center border-b border-gray-50 dark:border-gray-800/50 ${tierBg(rank)} hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors`}
          >
            <span className={`text-sm font-bold ${tierColor(rank)}`}>{rank}</span>
            <img
              src={espnLogo(team.abbrev)}
              alt={team.abbrev}
              className="w-7 h-7 object-contain"
              loading="lazy"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {team.name}
            </span>
            <span className="text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
              {team.offense?.toFixed(2) ?? '—'}
            </span>
            <span className="text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
              {team.defense?.toFixed(2) ?? '—'}
            </span>
            <span className={`text-sm font-bold text-right tabular-nums ${tierColor(rank)}`}>
              {team.composite?.toFixed(1) ?? '—'}
            </span>
            <span className="text-center text-sm">
              {trend > 0 && <span className="text-green-500">&#9650;</span>}
              {trend < 0 && <span className="text-red-500">&#9660;</span>}
              {trend === 0 && <span className="text-gray-400">&#8212;</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: This Week
// ---------------------------------------------------------------------------

function ThisWeekView() {
  const { data: games, loading, error, offline, reload } = useNflData(fetchGames);

  if (offline) return <BackendOffline onCheck={reload} />;
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!games || games.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">
        No upcoming games found. Check back closer to game day.
      </p>
    );
  }

  const tierOrder = { strong: 0, lean: 1, none: 2 };
  const sorted = [...games].sort(
    (a, b) => (tierOrder[a.edge_tier] ?? 2) - (tierOrder[b.edge_tier] ?? 2)
  );

  return (
    <div className="space-y-4">
      {sorted.map((game) => (
        <div
          key={game.id ?? `${game.away_team}-${game.home_team}`}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden"
        >
          {/* Game header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={espnLogo(game.away_abbrev)} alt={game.away_abbrev} className="w-7 h-7 object-contain" loading="lazy" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                {game.away_team} @ {game.home_team}
              </span>
              <img src={espnLogo(game.home_abbrev)} alt={game.home_abbrev} className="w-7 h-7 object-contain" loading="lazy" />
            </div>
            <div className="flex items-center gap-2">
              {game.edge_tier && game.edge_tier !== 'none' && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${edgeBadge(game.edge_tier)}`}>
                  {game.edge_tier === 'strong' ? 'Strong Edge' : 'Lean'}
                </span>
              )}
              {game.kickoff && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(game.kickoff).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {/* Spread + Total comparison */}
          <div className="px-4 py-3 grid grid-cols-2 gap-4">
            {/* Spread */}
            <div>
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Spread</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Model</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {game.model_spread != null ? (game.model_spread > 0 ? '+' : '') + game.model_spread.toFixed(1) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">FanDuel</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {game.fd_spread != null ? (game.fd_spread > 0 ? '+' : '') + game.fd_spread.toFixed(1) : '—'}
                  </span>
                </div>
                {game.spread_edge != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Edge</span>
                    <span className={`font-bold tabular-nums ${Math.abs(game.spread_edge) >= 3 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {game.spread_edge > 0 ? '+' : ''}{game.spread_edge.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div>
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Total</div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Model</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {game.model_total?.toFixed(1) ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">FanDuel</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {game.fd_total?.toFixed(1) ?? '—'}
                  </span>
                </div>
                {game.total_edge != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Edge</span>
                    <span className={`font-bold tabular-nums ${Math.abs(game.total_edge) >= 2 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {game.total_edge > 0 ? '+' : ''}{game.total_edge.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Weather + Injuries */}
          {(game.weather || game.injury_summary) && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              {game.weather && (
                <div className="flex items-center gap-1.5">
                  <span>&#9729;</span>
                  <span>{game.weather.temp}°F, Wind {game.weather.wind_mph} mph{game.weather.precip ? `, ${game.weather.precip}` : ''}</span>
                </div>
              )}
              {game.injury_summary && (
                <div className="flex items-center gap-1.5">
                  <span className="text-red-400">&#9888;</span>
                  <span>{game.injury_summary}</span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: Matchups
// ---------------------------------------------------------------------------

function MatchupsView() {
  const { data: matchups, loading, error, offline, reload } = useNflData(fetchMatchups);

  if (offline) return <BackendOffline onCheck={reload} />;
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!matchups || matchups.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">
        No matchup data available yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {matchups.map((game) => (
        <div
          key={game.id ?? `${game.away_team}-${game.home_team}`}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <img src={espnLogo(game.away_abbrev)} alt={game.away_abbrev} className="w-7 h-7 object-contain" loading="lazy" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {game.away_team} @ {game.home_team}
            </span>
            <img src={espnLogo(game.home_abbrev)} alt={game.home_abbrev} className="w-7 h-7 object-contain" loading="lazy" />
          </div>

          <div className="px-4 py-3 space-y-3">
            {(game.positional_matchups ?? []).map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {m.label}
                  </span>
                  <span className={`text-xs font-bold ${m.advantage_team === game.away_team ? 'text-blue-600 dark:text-blue-400' : m.advantage_team === game.home_team ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {m.advantage_team ?? 'Even'}
                  </span>
                </div>
                {/* Advantage bar */}
                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-l-full"
                    style={{ width: `${m.away_pct ?? 50}%` }}
                  />
                  <div
                    className="h-full bg-purple-500 dark:bg-purple-400 rounded-r-full"
                    style={{ width: `${m.home_pct ?? 50}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  <span>{game.away_abbrev} {m.away_pct ?? 50}%</span>
                  <span>{game.home_abbrev} {m.home_pct ?? 50}%</span>
                </div>
              </div>
            ))}

            {(!game.positional_matchups || game.positional_matchups.length === 0) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No positional matchup data available for this game.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: Futures
// ---------------------------------------------------------------------------

function FuturesView() {
  const { data: futures, loading, error, offline, reload } = useNflData(fetchFutures);
  const [sortKey, setSortKey] = useState('gap');
  const [sortDir, setSortDir] = useState('desc');

  if (offline) return <BackendOffline onCheck={reload} />;
  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!futures || futures.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">
        No futures data available yet. This view is most useful during the offseason.
      </p>
    );
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...futures].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const SortHeader = ({ label, field, align = 'text-right' }) => (
    <button
      onClick={() => handleSort(field)}
      className={`text-xs font-semibold uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${align} ${sortKey === field ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}
    >
      {label}
      {sortKey === field && (
        <span className="ml-0.5">{sortDir === 'asc' ? '▲' : '▼'}</span>
      )}
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem_4rem_5rem_5rem] gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <span />
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Team</span>
        <SortHeader label="Proj W" field="projected_wins" />
        <SortHeader label="FD Line" field="fd_win_total" />
        <SortHeader label="Gap" field="gap" />
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Direction</span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Edge</span>
      </div>

      {sorted.map((team) => {
        const gap = team.gap ?? 0;
        const direction = gap > 0 ? 'Over' : gap < 0 ? 'Under' : '—';
        const dirColor = gap > 0
          ? 'text-green-600 dark:text-green-400'
          : gap < 0
          ? 'text-red-500 dark:text-red-400'
          : 'text-gray-500 dark:text-gray-400';

        return (
          <div
            key={team.abbrev}
            className="grid grid-cols-[2.5rem_1fr_5rem_5rem_4rem_5rem_5rem] gap-2 px-4 py-2.5 items-center border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
          >
            <img
              src={espnLogo(team.abbrev)}
              alt={team.abbrev}
              className="w-7 h-7 object-contain"
              loading="lazy"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {team.name}
            </span>
            <span className="text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
              {team.projected_wins?.toFixed(1) ?? '—'}
            </span>
            <span className="text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">
              {team.fd_win_total?.toFixed(1) ?? '—'}
            </span>
            <span className={`text-sm font-bold text-right tabular-nums ${Math.abs(gap) >= 1.5 ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {gap > 0 ? '+' : ''}{gap.toFixed(1)}
            </span>
            <span className={`text-sm font-medium text-right ${dirColor}`}>
              {direction}
            </span>
            <span className="text-right">
              {team.edge_tier && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${edgeBadge(team.edge_tier)}`}>
                  {team.edge_tier}
                </span>
              )}
              {!team.edge_tier && <span className="text-xs text-gray-400">—</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-view: Player Rankings
// ---------------------------------------------------------------------------

const POS_TABS = ['QB', 'WR', 'RB', 'TE'];

const PLAYER_COLUMNS = {
  QB: [
    { key: 'rank', label: '#', w: 'w-8' },
    { key: 'player_name', label: 'Player', w: 'flex-1 min-w-0' },
    { key: 'team', label: 'Team', w: 'w-14' },
    { key: 'epa', label: 'EPA', w: 'w-16' },
    { key: 'pass_yds', label: 'Pass Yds', w: 'w-18' },
    { key: 'pass_td', label: 'TD', w: 'w-12' },
    { key: 'int', label: 'INT', w: 'w-12' },
    { key: 'completions', label: 'Cmp', w: 'w-12' },
    { key: 'attempts', label: 'Att', w: 'w-12' },
    { key: 'rush_yds', label: 'Rush', w: 'w-14' },
  ],
  WR: [
    { key: 'rank', label: '#', w: 'w-8' },
    { key: 'player_name', label: 'Player', w: 'flex-1 min-w-0' },
    { key: 'team', label: 'Team', w: 'w-14' },
    { key: 'rec_yds', label: 'Rec Yds', w: 'w-18' },
    { key: 'receptions', label: 'Rec', w: 'w-12' },
    { key: 'targets', label: 'Tgt', w: 'w-12' },
    { key: 'rec_td', label: 'TD', w: 'w-12' },
    { key: 'epa', label: 'EPA', w: 'w-16' },
    { key: 'target_share', label: 'Tgt%', w: 'w-14' },
    { key: 'air_yds', label: 'Air Yds', w: 'w-16' },
  ],
  RB: [
    { key: 'rank', label: '#', w: 'w-8' },
    { key: 'player_name', label: 'Player', w: 'flex-1 min-w-0' },
    { key: 'team', label: 'Team', w: 'w-14' },
    { key: 'rush_yds', label: 'Rush Yds', w: 'w-18' },
    { key: 'carries', label: 'Car', w: 'w-12' },
    { key: 'rush_td', label: 'Rush TD', w: 'w-16' },
    { key: 'epa', label: 'EPA', w: 'w-16' },
    { key: 'receptions', label: 'Rec', w: 'w-12' },
    { key: 'rec_yds', label: 'Rec Yds', w: 'w-16' },
    { key: 'rec_td', label: 'Rec TD', w: 'w-14' },
  ],
  TE: [
    { key: 'rank', label: '#', w: 'w-8' },
    { key: 'player_name', label: 'Player', w: 'flex-1 min-w-0' },
    { key: 'team', label: 'Team', w: 'w-14' },
    { key: 'rec_yds', label: 'Rec Yds', w: 'w-18' },
    { key: 'receptions', label: 'Rec', w: 'w-12' },
    { key: 'targets', label: 'Tgt', w: 'w-12' },
    { key: 'rec_td', label: 'TD', w: 'w-12' },
    { key: 'epa', label: 'EPA', w: 'w-16' },
    { key: 'target_share', label: 'Tgt%', w: 'w-14' },
  ],
};

function PlayersView() {
  const [pos, setPos] = useState('QB');
  const fetcher = useCallback(() => fetchPlayers(pos), [pos]);
  const { data: players, loading, error, offline, reload } = useNflData(fetcher);

  if (offline) return <BackendOffline onCheck={reload} />;

  const columns = PLAYER_COLUMNS[pos];

  return (
    <div className="space-y-4">
      {/* Position tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {POS_TABS.map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pos === p
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading && <Spinner />}
      {error && <ErrorBanner message={error} onRetry={reload} />}

      {!loading && !error && (!players || players.length === 0) && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-12 text-sm">
          No player data yet. Hit "Refresh Ratings" to load.
        </p>
      )}

      {!loading && players && players.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            {columns.map((col) => (
              <span
                key={col.key}
                className={`text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider ${col.w} ${col.key === 'player_name' ? 'text-left' : 'text-right'}`}
              >
                {col.label}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {players.map((player, i) => (
              <div
                key={`${player.player_name}-${i}`}
                className="flex gap-2 px-4 py-2 items-center hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                {columns.map((col) => {
                  const val = player[col.key];
                  const isName = col.key === 'player_name';
                  const isRank = col.key === 'rank';
                  const isEpa = col.key === 'epa';
                  const display = val == null ? '—'
                    : col.key === 'target_share' ? `${(val * 100).toFixed(1)}%`
                    : typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(1)
                    : val;

                  return (
                    <span
                      key={col.key}
                      className={`text-sm ${col.w} ${
                        isName
                          ? 'font-medium text-gray-900 dark:text-white truncate text-left'
                          : isRank
                            ? 'font-bold text-gray-400 dark:text-gray-500 text-right'
                            : isEpa
                              ? `font-semibold text-right ${val > 0 ? 'text-green-600 dark:text-green-400' : val < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`
                              : 'text-gray-600 dark:text-gray-400 tabular-nums text-right'
                      }`}
                    >
                      {display}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SUB_TABS = [
  { key: 'rankings', label: 'Rankings' },
  { key: 'players', label: 'Players' },
  { key: 'thisweek', label: 'This Week' },
  { key: 'matchups', label: 'Matchups' },
  { key: 'futures', label: 'Futures' },
];

export default function NFLPowerRankings() {
  const [activeTab, setActiveTab] = useState('rankings');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async (includeOdds) => {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const { triggerRefresh } = await import('../lib/nflApi');
      const result = await triggerRefresh(includeOdds);
      setRefreshResult(result.summary || result);
      // Bump key to force sub-views to re-fetch without leaving the tab
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setRefreshResult({ status: 'error', error: err.message });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Refresh controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => handleRefresh(false)}
          disabled={refreshing}
          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {refreshing ? 'Running pipeline...' : 'Refresh Ratings (free)'}
        </button>
        <button
          onClick={() => handleRefresh(true)}
          disabled={refreshing}
          title="Also pulls FanDuel lines — costs Odds API credits"
          className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          + FanDuel Odds (costs credits)
        </button>
        {refreshResult && (
          <span className={`text-xs ${refreshResult.status === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
            {refreshResult.status === 'error'
              ? refreshResult.error
              : `Done — ${refreshResult.teams_rated || 0} teams rated, ${refreshResult.sources_fetched?.length || 0} sources`}
          </span>
        )}
      </div>

      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {SUB_TABS.map((tab) => (
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

      {/* Active sub-view */}
      {activeTab === 'rankings' && <RankingsView key={refreshKey} />}
      {activeTab === 'players' && <PlayersView key={refreshKey} />}
      {activeTab === 'thisweek' && <ThisWeekView key={refreshKey} />}
      {activeTab === 'matchups' && <MatchupsView key={refreshKey} />}
      {activeTab === 'futures' && <FuturesView key={refreshKey} />}
    </div>
  );
}
