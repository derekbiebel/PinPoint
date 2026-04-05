const NFL_API = import.meta.env.VITE_NFL_API_URL || 'http://localhost:8000/api';

export async function fetchTeamRatings() {
  const res = await fetch(`${NFL_API}/teams`);
  if (!res.ok) throw new Error('Failed to fetch team ratings');
  return res.json();
}

export async function fetchGames() {
  const res = await fetch(`${NFL_API}/games`);
  if (!res.ok) throw new Error('Failed to fetch games');
  return res.json();
}

export async function fetchFutures() {
  const res = await fetch(`${NFL_API}/futures`);
  if (!res.ok) throw new Error('Failed to fetch futures');
  return res.json();
}

export async function fetchMatchups() {
  const res = await fetch(`${NFL_API}/matchups`);
  if (!res.ok) throw new Error('Failed to fetch matchups');
  return res.json();
}

export async function fetchStatus() {
  const res = await fetch(`${NFL_API}/status`);
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function triggerRefresh() {
  const res = await fetch(`${NFL_API}/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger refresh');
  return res.json();
}
