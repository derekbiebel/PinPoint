import useStore from '../store/useStore';
import { canAffordRefresh, getRefreshesLeft } from '../lib/oddsApi';

export default function LastRefreshed() {
  const lastFetched = useStore((s) => s.lastFetched);
  const isLoading = useStore((s) => s.isLoading);
  const requestsRemaining = useStore((s) => s.requestsRemaining);
  const refresh = useStore((s) => s.refresh);

  const affordable = canAffordRefresh(requestsRemaining);
  const refreshesLeft = getRefreshesLeft(requestsRemaining);

  const formatted = lastFetched
    ? new Date(lastFetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  const label = refreshesLeft !== null ? `Refresh (${refreshesLeft} left)` : 'Refresh';

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {formatted}
      </span>
      <button
        onClick={refresh}
        disabled={isLoading || !affordable}
        title={!affordable ? 'Not enough API requests remaining' : `${refreshesLeft} refreshes left this month`}
        className="px-3 py-1 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Loading...' : label}
      </button>
    </div>
  );
}
