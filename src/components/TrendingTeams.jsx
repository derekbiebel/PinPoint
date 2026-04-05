import { useState, useMemo } from 'react';

const SPORT_LABELS = {
  americanfootball_nfl: 'NFL',
  basketball_nba: 'NBA',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
};

const SPORT_KEYS = [
  { key: 'all', label: 'All' },
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'baseball_mlb', label: 'MLB' },
  { key: 'icehockey_nhl', label: 'NHL' },
];

const VIEWS = [
  { key: 'overall', label: 'Overall' },
  { key: 'hot', label: 'Hottest Streaks' },
  { key: 'home', label: 'Best at Home' },
  { key: 'away', label: 'Best on Road' },
];

function parseRecord(record) {
  if (!record) return null;
  const parts = record.split('-').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const total = parts[0] + parts[1];
  if (total === 0) return null;
  return { wins: parts[0], losses: parts[1], pct: parts[0] / total };
}

function parseStreak(streak) {
  if (!streak) return { type: null, length: 0, score: 0 };
  const match = streak.match(/^(W|L)(\d+)$/i);
  if (!match) return { type: null, length: 0, score: 0 };
  const type = match[1].toUpperCase();
  const length = parseInt(match[2]);
  return { type, length, score: type === 'W' ? length : -length };
}

function RankBadge({ rank }) {
  const colors =
    rank === 1
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      : rank === 2
        ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
        : rank === 3
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200'
          : 'bg-transparent text-gray-400 dark:text-gray-500';

  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colors}`}>
      {rank}
    </span>
  );
}

function StreakPill({ streak }) {
  const { type, length } = parseStreak(streak);
  if (!type) return <span className="text-xs text-gray-400">—</span>;

  const color =
    type === 'W'
      ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300';

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {type}{length}
    </span>
  );
}

export default function TrendingTeams({ teamStats }) {
  const [sport, setSport] = useState('all');
  const [view, setView] = useState('overall');

  const teams = useMemo(() => {
    let list = Object.values(teamStats);
    if (sport !== 'all') {
      list = list.filter((t) => t.sportKey === sport);
    }
    return list;
  }, [teamStats, sport]);

  const sorted = useMemo(() => {
    const copy = [...teams];

    if (view === 'overall') {
      copy.sort((a, b) => b.winPct - a.winPct);
    } else if (view === 'hot') {
      copy.sort((a, b) => {
        const sa = parseStreak(a.streak);
        const sb = parseStreak(b.streak);
        return sb.score - sa.score;
      });
    } else if (view === 'home') {
      copy.sort((a, b) => {
        const ha = parseRecord(a.homeRecord);
        const hb = parseRecord(b.homeRecord);
        return (hb?.pct ?? 0) - (ha?.pct ?? 0);
      });
    } else if (view === 'away') {
      copy.sort((a, b) => {
        const aa = parseRecord(a.awayRecord);
        const ab = parseRecord(b.awayRecord);
        return (ab?.pct ?? 0) - (aa?.pct ?? 0);
      });
    }

    return copy;
  }, [teams, view]);

  if (Object.keys(teamStats).length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <div className="animate-spin inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mb-2" />
        <p className="text-sm">Loading team data from ESPN...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sport filter */}
      <div className="flex gap-2 flex-wrap">
        {SPORT_KEYS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSport(s.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              sport === s.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === v.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Team</div>
          <div className="col-span-2 text-center">Record</div>
          <div className="col-span-1 text-center">Win%</div>
          <div className="col-span-2 text-center">
            {view === 'home' ? 'Home' : view === 'away' ? 'Road' : 'Streak'}
          </div>
          <div className="col-span-2 text-center">
            {view === 'home' || view === 'away' ? 'Win%' : 'Last 10'}
          </div>
        </div>

        {/* Team rows */}
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {sorted.map((team, i) => {
            const homeRec = parseRecord(team.homeRecord);
            const awayRec = parseRecord(team.awayRecord);
            const contextRec = view === 'home' ? homeRec : view === 'away' ? awayRec : null;
            const contextRecord = view === 'home' ? team.homeRecord : view === 'away' ? team.awayRecord : null;

            return (
              <div
                key={team.name}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
              >
                <div className="col-span-1">
                  <RankBadge rank={i + 1} />
                </div>
                <div className="col-span-4 flex items-center gap-2 min-w-0">
                  {team.logo && (
                    <img src={team.logo} alt="" className="w-6 h-6 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate block">
                      {team.name}
                    </span>
                    {sport === 'all' && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {SPORT_LABELS[team.sportKey]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-center text-sm text-gray-600 dark:text-gray-400">
                  {team.wins}-{team.losses}
                </div>
                <div className="col-span-1 text-center">
                  <span className={`text-sm font-semibold ${
                    team.winPct >= 0.600
                      ? 'text-green-600 dark:text-green-400'
                      : team.winPct < 0.400
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    .{(team.winPct * 1000).toFixed(0).padStart(3, '0')}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  {(view === 'home' || view === 'away') ? (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {contextRecord || '—'}
                    </span>
                  ) : (
                    <StreakPill streak={team.streak} />
                  )}
                </div>
                <div className="col-span-2 text-center">
                  {(view === 'home' || view === 'away') ? (
                    <span className={`text-sm font-semibold ${
                      contextRec && contextRec.pct >= 0.600
                        ? 'text-green-600 dark:text-green-400'
                        : contextRec && contextRec.pct < 0.400
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {contextRec ? `.${(contextRec.pct * 1000).toFixed(0).padStart(3, '0')}` : '—'}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {team.last10 || '—'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
