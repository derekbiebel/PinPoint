const BASE = 'https://api.the-odds-api.com/v4';
const API_KEY_STORAGE = 'pinpoint_api_key';

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function hasValidKey() {
  const key = getApiKey();
  return key && key !== 'your_key_here';
}

const SPORTS = [
  'americanfootball_nfl',
  'basketball_nba',
  'baseball_mlb',
  'icehockey_nhl',
];

const BOOKMAKERS = 'fanduel,draftkings,betmgm,caesars,pointsbet';
const MONTHLY_BUDGET = 500;
const COST_PER_SPORT = 3; // 3 markets × 1 region
const COST_PER_SCORES = SPORTS.length * 1; // 1 request per sport for scores
const COST_PER_REFRESH = SPORTS.length * COST_PER_SPORT + COST_PER_SCORES; // 16 (odds + scores)
const SAFETY_BUFFER = 15; // stop before absolute zero so you're never locked out

export function getRemainingRequests(responseHeaders) {
  const remaining = responseHeaders.get('x-requests-remaining');
  return remaining ? parseInt(remaining, 10) : null;
}

export function getUsedRequests(responseHeaders) {
  const used = responseHeaders.get('x-requests-used');
  return used ? parseInt(used, 10) : null;
}

export function canAffordRefresh(apiRemaining) {
  if (apiRemaining === null) return true; // first fetch, no data yet — allow it
  return apiRemaining >= COST_PER_REFRESH + SAFETY_BUFFER;
}

export function getRefreshesLeft(apiRemaining) {
  if (apiRemaining === null) return null;
  return Math.max(0, Math.floor((apiRemaining - SAFETY_BUFFER) / COST_PER_REFRESH));
}

// Cheap check: fetch a single sport with no markets just to read the header
export async function checkBudget() {
  const url = `${BASE}/sports?apiKey=${getApiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error (${res.status})`);
  const remaining = getRemainingRequests(res.headers);
  const used = getUsedRequests(res.headers);
  console.log(`[Odds API] Budget check — remaining: ${remaining}, used: ${used}`);
  return { remaining, used };
}

export async function fetchOddsForSport(sportKey) {
  const url = `${BASE}/sports/${sportKey}/odds?apiKey=${getApiKey()}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=${BOOKMAKERS}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text}`);
  }

  const remaining = getRemainingRequests(res.headers);
  console.log(`[Odds API] ${sportKey} — requests remaining: ${remaining}`);

  const data = await res.json();
  return { data, remaining };
}

export async function fetchAllOdds(knownRemaining) {
  // Pre-flight: if we already know remaining from a prior call, check it
  if (knownRemaining !== null && !canAffordRefresh(knownRemaining)) {
    throw new Error(
      `Only ${knownRemaining} API requests remaining — not enough for a refresh (needs ${COST_PER_REFRESH + SAFETY_BUFFER}). Resets next month.`
    );
  }

  let lastRemaining = null;
  const allGames = [];

  for (const sport of SPORTS) {
    try {
      const { data, remaining } = await fetchOddsForSport(sport);
      allGames.push(...data);
      lastRemaining = remaining;
    } catch (err) {
      console.warn(`[Odds API] Failed to fetch ${sport}:`, err.message);
    }
  }

  return { games: allGames, remaining: lastRemaining };
}

export async function fetchScoresForSport(sportKey, daysFrom = 3) {
  const url = `${BASE}/sports/${sportKey}/scores?apiKey=${getApiKey()}&daysFrom=${daysFrom}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Scores API error (${res.status}): ${text}`);
  }

  const remaining = getRemainingRequests(res.headers);
  console.log(`[Odds API] Scores ${sportKey} — requests remaining: ${remaining}`);

  const data = await res.json();
  return { data, remaining };
}

export async function fetchAllScores() {
  let lastRemaining = null;
  const allScores = [];

  for (const sport of SPORTS) {
    try {
      const { data, remaining } = await fetchScoresForSport(sport);
      allScores.push(...data);
      lastRemaining = remaining;
    } catch (err) {
      console.warn(`[Odds API] Failed to fetch scores for ${sport}:`, err.message);
    }
  }

  return { scores: allScores, remaining: lastRemaining };
}

export async function fetchHistoricalOdds(sportKey, isoDate) {
  const url = `${BASE}/sports/${sportKey}/odds-history?apiKey=${getApiKey()}&regions=us&markets=h2h&oddsFormat=american&date=${isoDate}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Historical API error (${res.status}): ${text}`);
  }

  const remaining = getRemainingRequests(res.headers);
  console.log(`[Odds API] Historical ${sportKey} — requests remaining: ${remaining}`);

  const data = await res.json();
  return { data, remaining };
}

export { SPORTS, MONTHLY_BUDGET, COST_PER_REFRESH };
