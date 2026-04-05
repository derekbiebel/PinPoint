import { create } from 'zustand';
import { fetchAllOdds, fetchAllScores, checkBudget, canAffordRefresh, COST_PER_REFRESH } from '../lib/oddsApi';
import { processGames } from '../lib/valueModel';
import { placeBets, resolveBets, getBets } from '../lib/betTracker';
import { fetchAllTeamStats } from '../lib/teamStats';

const useStore = create((set, get) => ({
  games: [],
  rawOdds: {},
  lastFetched: null,
  selectedSport: 'all',
  isLoading: false,
  error: null,
  requestsRemaining: null,
  requestsUsed: null,
  bets: getBets(),
  teamStats: {},

  setSelectedSport: (key) => set({ selectedSport: key }),

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

    if (requestsRemaining !== null && !canAffordRefresh(requestsRemaining)) {
      set({
        error: `Only ${requestsRemaining} API requests left — not enough for a refresh (costs ~${COST_PER_REFRESH}). Resets next month.`,
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      // Fetch odds and team stats in parallel
      const [oddsResult, teamStats] = await Promise.all([
        fetchAllOdds(requestsRemaining),
        fetchAllTeamStats().catch((err) => {
          console.warn('[Team stats failed]', err.message);
          return {};
        }),
      ]);

      const { games: rawGames, remaining: oddsRemaining } = oddsResult;
      const processed = processGames(rawGames, teamStats);

      const rawOdds = {};
      for (const game of rawGames) {
        if (!rawOdds[game.sport_key]) rawOdds[game.sport_key] = [];
        rawOdds[game.sport_key].push(game);
      }

      // Place phantom bets on value edges
      const { bets: updatedBets } = placeBets(processed);

      // Fetch scores and resolve pending bets
      let lastRemaining = oddsRemaining;
      try {
        const { scores, remaining: scoresRemaining } = await fetchAllScores();
        const { bets: resolvedBets } = resolveBets(scores);
        lastRemaining = scoresRemaining;
        set({ bets: resolvedBets });
      } catch (err) {
        console.warn('[Scores fetch failed]', err.message);
        set({ bets: updatedBets });
      }

      set({
        games: processed,
        rawOdds,
        teamStats,
        lastFetched: new Date().toISOString(),
        requestsRemaining: lastRemaining,
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
