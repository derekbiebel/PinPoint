const STORAGE_KEY = 'pinpoint_bets';
const STAKE = 10;

function loadBets() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveBets(bets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
}

function payout(stake, americanOdds) {
  if (americanOdds > 0) return stake * (americanOdds / 100);
  return stake * (100 / Math.abs(americanOdds));
}

function betId(gameId, market, outcomeName, point, book) {
  return `${gameId}|${market}|${outcomeName}|${point ?? ''}|${book}`;
}

// Place phantom bets on all value edges (>= 3%) for processed games.
// Only places one bet per game+market+outcome (the best book).
export function placeBets(processedGames) {
  const bets = loadBets();
  const existingIds = new Set(bets.map((b) => b.id));
  let added = 0;

  for (const game of processedGames) {
    // Group value edges by market+outcome, pick the best book for each
    const bestByOutcome = {};
    for (const edge of game.edges) {
      if (edge.edgeLevel === 'none') continue;
      const key = `${edge.market}|${edge.outcomeName}|${edge.point ?? ''}`;
      if (!bestByOutcome[key] || edge.edgePct > bestByOutcome[key].edgePct) {
        bestByOutcome[key] = edge;
      }
    }

    for (const edge of Object.values(bestByOutcome)) {
      const id = betId(game.id, edge.market, edge.outcomeName, edge.point, edge.book);
      if (existingIds.has(id)) continue;

      bets.push({
        id,
        gameId: game.id,
        sportKey: game.sport_key,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        market: edge.market,
        outcomeName: edge.outcomeName,
        point: edge.point ?? null,
        book: edge.bookTitle,
        price: edge.price,
        edgePct: edge.edgePct,
        stake: STAKE,
        potentialPayout: payout(STAKE, edge.price),
        status: 'pending', // pending | won | lost | push
        profit: null,
        placedAt: new Date().toISOString(),
        resolvedAt: null,
      });
      existingIds.add(id);
      added++;
    }
  }

  if (added > 0) saveBets(bets);
  return { bets, added };
}

// Resolve pending bets against score data.
// scores: array from The Odds API /scores endpoint
export function resolveBets(scores) {
  const bets = loadBets();
  const scoreMap = {};
  for (const s of scores) {
    if (s.completed) scoreMap[s.id] = s;
  }

  let resolved = 0;

  for (const bet of bets) {
    if (bet.status !== 'pending') continue;

    const score = scoreMap[bet.gameId];
    if (!score || !score.scores || score.scores.length < 2) continue;

    const homeScore = parseFloat(score.scores.find((s) => s.name === bet.homeTeam)?.score);
    const awayScore = parseFloat(score.scores.find((s) => s.name === bet.awayTeam)?.score);
    if (isNaN(homeScore) || isNaN(awayScore)) continue;

    let won = null;

    if (bet.market === 'h2h') {
      const winner = homeScore > awayScore ? bet.homeTeam : bet.awayTeam;
      won = bet.outcomeName === winner;
    } else if (bet.market === 'spreads') {
      // Outcome is a team name with a point spread
      const isHome = bet.outcomeName === bet.homeTeam;
      const teamScore = isHome ? homeScore : awayScore;
      const oppScore = isHome ? awayScore : homeScore;
      const adjusted = teamScore + bet.point;
      if (adjusted === oppScore) {
        bet.status = 'push';
        bet.profit = 0;
        bet.resolvedAt = new Date().toISOString();
        resolved++;
        continue;
      }
      won = adjusted > oppScore;
    } else if (bet.market === 'totals') {
      const total = homeScore + awayScore;
      if (total === bet.point) {
        bet.status = 'push';
        bet.profit = 0;
        bet.resolvedAt = new Date().toISOString();
        resolved++;
        continue;
      }
      won = bet.outcomeName === 'Over' ? total > bet.point : total < bet.point;
    }

    if (won === null) continue;

    bet.status = won ? 'won' : 'lost';
    bet.profit = won ? payout(bet.stake, bet.price) : -bet.stake;
    bet.resolvedAt = new Date().toISOString();
    resolved++;
  }

  if (resolved > 0) saveBets(bets);
  return { bets, resolved };
}

export function getBets() {
  return loadBets();
}

export function getStats(bets) {
  const resolved = bets.filter((b) => b.status !== 'pending');
  const pending = bets.filter((b) => b.status === 'pending');
  const wins = resolved.filter((b) => b.status === 'won');
  const losses = resolved.filter((b) => b.status === 'lost');
  const pushes = resolved.filter((b) => b.status === 'push');

  const totalWagered = resolved.reduce((sum, b) => sum + b.stake, 0);
  const totalProfit = resolved.reduce((sum, b) => sum + (b.profit || 0), 0);
  const pendingRisk = pending.reduce((sum, b) => sum + b.stake, 0);
  const roi = totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0;

  return {
    total: bets.length,
    pending: pending.length,
    wins: wins.length,
    losses: losses.length,
    pushes: pushes.length,
    totalWagered,
    totalProfit,
    pendingRisk,
    roi,
  };
}

export function clearAllBets() {
  localStorage.removeItem(STORAGE_KEY);
}

export { STAKE };
