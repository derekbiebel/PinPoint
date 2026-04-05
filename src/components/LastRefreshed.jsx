import useStore from '../store/useStore';
import { canAffordRefresh, getRefreshesLeft } from '../lib/oddsApi';

export default function LastRefreshed() {
  const lastFetched = useStore((s) => s.lastFetched);
  const isLoading = useStore((s) => s.isLoading);
  const requestsRemaining = useStore((s) => s.requestsRemaining);
  const fetchOdds = useStore((s) => s.fetchOdds);

  const affordable = canAffordRefresh(requestsRemaining);
  const refreshesLeft = getRefreshesLeft(requestsRemaining);

  const formatted = lastFetched
    ? new Date(lastFetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Odds: {formatted}
      </span>
      <button
        onClick={fetchOdds}
        disabled={isLoading || !affordable}
        title={
          !affordable
            ? 'Not enough API requests remaining'
            : `Uses ~16 API credits. ${refreshesLeft} refreshes left this month.`
        }
        className="px-3 py-1 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
      >
        {isLoading ? (
          'Pulling odds...'
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Pull Odds ({refreshesLeft !== null ? refreshesLeft : '?'} left)
          </>
        )}
      </button>
    </div>
  );
}
