import useStore from '../store/useStore';

const SPORTS = [
  { key: 'all', label: 'All' },
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'baseball_mlb', label: 'MLB' },
  { key: 'icehockey_nhl', label: 'NHL' },
];

export default function SportFilter() {
  const selectedSport = useStore((s) => s.selectedSport);
  const setSelectedSport = useStore((s) => s.setSelectedSport);

  return (
    <div className="flex gap-2 flex-wrap">
      {SPORTS.map((sport) => (
        <button
          key={sport.key}
          onClick={() => setSelectedSport(sport.key)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedSport === sport.key
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {sport.label}
        </button>
      ))}
    </div>
  );
}
