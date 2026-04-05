import { create } from 'zustand';
import { fetchAllOdds, checkBudget, canAffordRefresh, getRefreshesLeft, COST_PER_REFRESH, MONTHLY_BUDGET } from '../lib/oddsApi';
import { processGames } from '../lib/valueModel';

const useStore = create((set, get) => ({
  games: [],
  rawOdds: {},
  lastFetched: null,
  selectedSport: 'all',
  isLoading: false,
  error: null,
  requestsRemaining: null,
  requestsUsed: null,

  setSelectedSport: (key) => set({ selectedSport: key }),

  // Cheap call to /sports just to read the x-requests-remaining header
  checkBudget: async () => {
    try {
      const { remaining, used } = await checkBudget();
      set({ requestsRemaining: remaining, requestsUsed: used });
    } catch (err) {
      console.warn('[Budget check failed]', err.message);
    }
  },

  fetchGames: async () => {
    const { requestsRemaining } = get();

    // If we know remaining and can't afford it, block immediately
    if (requestsRemaining !== null && !canAffordRefresh(requestsRemaining)) {
      set({
        error: `Only ${requestsRemaining} API requests left — not enough for a refresh (costs ~${COST_PER_REFRESH}). Resets next month.`,
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { games: rawGames, remaining } = await fetchAllOdds(requestsRemaining);
      const processed = processGames(rawGames);

      const rawOdds = {};
      for (const game of rawGames) {
        if (!rawOdds[game.sport_key]) rawOdds[game.sport_key] = [];
        rawOdds[game.sport_key].push(game);
      }

      set({
        games: processed,
        rawOdds,
        lastFetched: new Date().toISOString(),
        requestsRemaining: remaining,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  refresh: async () => {
    await get().fetchGames();
  },
}));

export default useStore;
