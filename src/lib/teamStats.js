/**
 * Team performance data from ESPN's public endpoints.
 * No API key required. Covers NFL, NBA, MLB, NHL.
 *
 * Used to add context to edge calculations — a book-vs-consensus edge
 * on a hot team at home is worth more than the same edge on a cold
 * team on the road.
 */

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORT_PATHS = {
  americanfootball_nfl: 'football/nfl',
  basketball_nba: 'basketball/nba',
  baseball_mlb: 'baseball/mlb',
  icehockey_nhl: 'hockey/nhl',
};

// Fetch current standings (records, home/away splits, streaks)
async function fetchStandings(sportKey) {
  const path = SPORT_PATHS[sportKey];
  if (!path) return {};

  const url = `${ESPN_BASE}/${path}/standings`;
  const res = await fetch(url);
  if (!res.ok) return {};

  const data = await res.json();
  const teams = {};

  for (const group of data.children || []) {
    for (const child of group.standings?.entries || []) {
      const team = child.team;
      if (!team) continue;

      const statsMap = {};
      for (const s of child.stats || []) {
        statsMap[s.name] = s.displayValue || s.value;
      }

      teams[team.displayName] = {
        name: team.displayName,
        abbr: team.abbreviation,
        logo: team.logos?.[0]?.href,
        wins: parseInt(statsMap.wins) || 0,
        losses: parseInt(statsMap.losses) || 0,
        winPct: parseFloat(statsMap.winPercent || statsMap.winPct) || 0,
        streak: statsMap.streak || '',
        // Home/away records where available
        homeRecord: statsMap.Home || statsMap.home || null,
        awayRecord: statsMap.Road || statsMap.road || statsMap.away || null,
        // Recent form
        last10: statsMap.Last_Ten || statsMap['Last Ten'] || null,
        divRecord: statsMap.vsDiv || statsMap.Division || null,
      };
    }
  }

  return teams;
}

// Fetch recent game results for a sport (last ~7 days)
async function fetchRecentScores(sportKey) {
  const path = SPORT_PATHS[sportKey];
  if (!path) return [];

  const url = `${ESPN_BASE}/${path}/scoreboard`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const results = [];

  for (const event of data.events || []) {
    const comp = event.competitions?.[0];
    if (!comp || comp.status?.type?.completed !== true) continue;

    const teams = {};
    for (const c of comp.competitors || []) {
      teams[c.homeAway] = {
        name: c.team?.displayName,
        score: parseInt(c.score) || 0,
        winner: c.winner,
      };
    }

    if (teams.home && teams.away) {
      results.push({
        home: teams.home.name,
        away: teams.away.name,
        homeScore: teams.home.score,
        awayScore: teams.away.score,
        winner: teams.home.winner ? teams.home.name : teams.away.name,
      });
    }
  }

  return results;
}

// Build a team context lookup for all sports
export async function fetchAllTeamStats() {
  const allTeams = {};

  const sportKeys = Object.keys(SPORT_PATHS);

  // Fetch standings for all sports in parallel
  const results = await Promise.allSettled(
    sportKeys.map((sk) => fetchStandings(sk).then((teams) => ({ sportKey: sk, teams })))
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { sportKey, teams } = result.value;
    for (const [name, data] of Object.entries(teams)) {
      allTeams[name] = { ...data, sportKey };
    }
  }

  console.log(`[Team Stats] Loaded ${Object.keys(allTeams).length} teams from ESPN`);
  return allTeams;
}

/**
 * Calculate a confidence modifier for an edge based on team context.
 *
 * Returns a multiplier (0.5 to 1.5):
 *  > 1.0 = team context supports this edge (hot team, good record, home advantage)
 *  < 1.0 = team context undermines this edge (cold team, bad record, road disadvantage)
 *  = 1.0 = no team data or neutral
 *
 * This doesn't replace the edge — it adjusts how much to trust it.
 */
export function confidenceModifier(teamName, isHome, teamStats) {
  const team = teamStats[teamName];
  if (!team) return { modifier: 1.0, factors: [] };

  const factors = [];
  let modifier = 1.0;

  // Win percentage factor
  if (team.winPct > 0) {
    if (team.winPct >= 0.600) {
      modifier += 0.15;
      factors.push({ label: 'Strong record', detail: `${team.wins}-${team.losses} (${(team.winPct * 100).toFixed(0)}%)`, impact: 'positive' });
    } else if (team.winPct >= 0.500) {
      factors.push({ label: 'Above .500', detail: `${team.wins}-${team.losses}`, impact: 'neutral' });
    } else if (team.winPct < 0.400) {
      modifier -= 0.15;
      factors.push({ label: 'Poor record', detail: `${team.wins}-${team.losses} (${(team.winPct * 100).toFixed(0)}%)`, impact: 'negative' });
    }
  }

  // Streak factor
  if (team.streak) {
    const streakMatch = team.streak.match(/^(W|L)(\d+)$/i);
    if (streakMatch) {
      const type = streakMatch[1].toUpperCase();
      const length = parseInt(streakMatch[2]);
      if (type === 'W' && length >= 4) {
        modifier += 0.10;
        factors.push({ label: 'Hot streak', detail: `Won ${length} straight`, impact: 'positive' });
      } else if (type === 'L' && length >= 4) {
        modifier -= 0.10;
        factors.push({ label: 'Cold streak', detail: `Lost ${length} straight`, impact: 'negative' });
      }
    }
  }

  // Home/away factor
  if (isHome && team.homeRecord) {
    const parts = team.homeRecord.split('-').map(Number);
    if (parts.length >= 2 && parts[0] + parts[1] > 0) {
      const homePct = parts[0] / (parts[0] + parts[1]);
      if (homePct >= 0.650) {
        modifier += 0.10;
        factors.push({ label: 'Strong at home', detail: team.homeRecord, impact: 'positive' });
      } else if (homePct < 0.400) {
        modifier -= 0.05;
        factors.push({ label: 'Weak at home', detail: team.homeRecord, impact: 'negative' });
      }
    }
  } else if (!isHome && team.awayRecord) {
    const parts = team.awayRecord.split('-').map(Number);
    if (parts.length >= 2 && parts[0] + parts[1] > 0) {
      const awayPct = parts[0] / (parts[0] + parts[1]);
      if (awayPct >= 0.600) {
        modifier += 0.10;
        factors.push({ label: 'Strong on road', detail: team.awayRecord, impact: 'positive' });
      } else if (awayPct < 0.350) {
        modifier -= 0.10;
        factors.push({ label: 'Weak on road', detail: team.awayRecord, impact: 'negative' });
      }
    }
  }

  // Clamp
  modifier = Math.max(0.5, Math.min(1.5, modifier));

  return { modifier, factors };
}
