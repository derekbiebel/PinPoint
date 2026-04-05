import { create } from 'zustand';
import { fetchAllOdds, fetchAllScores, checkBudget, canAffordRefresh, COST_PER_REFRESH } from '../lib/oddsApi';
import { processGames } from '../lib/valueModel';
import { placeBets, resolveBets, getBets } from '../lib/betTracker';
import { fetchAllTeamStats } from '../lib/teamStats';

// Persist raw odds to localStorage so they survive page refreshes
const ODDS_CACHE_KEY = 'pinpoint_odds_cache';

function loadCachedOdds() {
  try {
    const cached = localStorage.getItem(ODDS_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function saveCachedOdds(rawOdds, lastFetched) {
  try {
    localStorage.setItem(ODDS_CACHE_KEY, JSON.stringify({ rawOdds, lastFetched }));
  } catch {
    // localStorage full or unavailable — not critical
  }
}

const cached = loadCachedOdds();

const useStore = create((set, get) => ({
  games: [],
  rawOdds: cached?.rawOdds || {},
  lastFetched: cached?.lastFetched || null,
  selectedSport: 'all',
  isLoading: false,
  isLoadingTeams: false,
  error: null,
  requestsRemaining: null,
  requestsUsed: null,
  bets: getBets(),
  teamStats: {},
  _needsReprocess: !!cached, // flag to reprocess cached odds once team stats load

  setSelectedSport: (key) => set({ selectedSport: key }),

  // Free — just loads ESPN data, no API cost
  loadTeamStats: async () => {
    set({ isLoadingTeams: true });
    try {
      const teamStats = await fetchAllTeamStats();
      set({ teamStats, isLoadingTeams: false });

      // Reprocess cached or current raw odds with fresh team data
      const { rawOdds } = get();
      const allRaw = Object.values(rawOdds).flat();
      if (allRaw.length > 0) {
        const processed = processGames(allRaw, teamStats);
        set({ games: processed, _needsReprocess: false });
      }
    } catch (err) {
      console.warn('[Team stats failed]', err.message);
      set({ isLoadingTeams: false });
    }
  },

  checkBudget: async () => {
    try {
      const { remaining, used } = await checkBudget();
      set({ requestsRemaining: remaining, requestsUsed: used });
    } catch (err) {
      console.warn('[Budget check failed]', err.message);
    }
  },

  // Costs API credits — only called by explicit button press
  fetchOdds: async () => {
    const { requestsRemaining, teamStats } = get();

    if (requestsRemaining !== null && !canAffordRefresh(requestsRemaining)) {
      set({
        error: `Only ${requestsRemaining} API requests left — not enough for a refresh (costs ~${COST_PER_REFRESH}). Resets next month.`,
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      // Fetch odds (and fresh team stats in parallel if we don't have them)
      const hasTeams = Object.keys(teamStats).length > 0;
      const [oddsResult, freshTeamStats] = await Promise.all([
        fetchAllOdds(requestsRemaining),
        hasTeams
          ? Promise.resolve(teamStats)
          : fetchAllTeamStats().catch(() => ({})),
      ]);

      const finalTeamStats = hasTeams ? teamStats : freshTeamStats;
      const { games: rawGames, remaining: oddsRemaining } = oddsResult;
      const processed = processGames(rawGames, finalTeamStats);

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

      const lastFetched = new Date().toISOString();

      // Save to localStorage so it survives page refreshes
      saveCachedOdds(rawOdds, lastFetched);

      set({
        games: processed,
        rawOdds,
        teamStats: finalTeamStats,
        lastFetched,
        requestsRemaining: lastRemaining,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },
}));

export default useStore;
