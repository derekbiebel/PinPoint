const NFL_API = import.meta.env.VITE_NFL_API_URL || 'http://localhost:8000/api';

export async function fetchTeamRatings() {
  const res = await fetch(`${NFL_API}/teams`);
  if (!res.ok) throw new Error('Failed to fetch team ratings');
  const data = await res.json();
  return data.teams || [];
}

export async function fetchGames() {
  const res = await fetch(`${NFL_API}/games`);
  if (!res.ok) throw new Error('Failed to fetch games');
  const data = await res.json();
  return data.games || [];
}

export async function fetchFutures() {
  const res = await fetch(`${NFL_API}/futures`);
  if (!res.ok) throw new Error('Failed to fetch futures');
  const data = await res.json();
  return data.futures || [];
}

export async function fetchMatchups() {
  const res = await fetch(`${NFL_API}/matchups`);
  if (!res.ok) throw new Error('Failed to fetch matchups');
  const data = await res.json();
  return data.matchups || [];
}

export async function fetchPlayers(position = null) {
  const url = position ? `${NFL_API}/players?position=${position}` : `${NFL_API}/players`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch players');
  const data = await res.json();
  if (position) return data.players || [];
  return data.players || {};
}

export async function fetchStatus() {
  const res = await fetch(`${NFL_API}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function triggerRefresh(includeOdds = false) {
  const url = includeOdds ? `${NFL_API}/refresh?include_odds=true` : `${NFL_API}/refresh`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger refresh');
  return res.json();
}
