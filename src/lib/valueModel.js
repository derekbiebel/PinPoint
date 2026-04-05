/**
 * Value model — team-performance-based edge detection.
 *
 * Instead of comparing books against each other, this model builds its
 * own win probability from team stats (record, streak, home/away splits)
 * and compares that against FanDuel's implied odds. Value = our model
 * thinks the team wins more often than FanDuel's price suggests.
 */

import { confidenceModifier } from './teamStats';

export function impliedProb(americanOdds) {
  if (americanOdds > 0) return 100 / (americanOdds + 100);
  return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

export function vigFreeProbs(odds1, odds2) {
  const p1 = impliedProb(odds1);
  const p2 = impliedProb(odds2);
  const total = p1 + p2;
  return { prob1: p1 / total, prob2: p2 / total };
}

/**
 * Build a model probability for a team based on performance stats.
 *
 * Starts from a 50/50 base and adjusts based on:
 *  - Overall win percentage (strongest signal)
 *  - Home/away record for this specific venue context
 *  - Current streak (momentum)
 *
 * Returns a probability between 0.20 and 0.80 — we cap it because
 * team stats alone can't predict with extreme confidence.
 */
export function modelProbability(teamName, isHome, opponentName, teamStats) {
  const team = teamStats[teamName];
  const opp = teamStats[opponentName];

  if (!team) return null;

  let prob = 0.50;

  // 1. Win percentage — strongest signal
  // Shift based on how far above/below .500 this team is
  if (team.winPct > 0) {
    prob += (team.winPct - 0.500) * 0.40; // e.g. .600 team → +0.04
  }

  // 2. Opponent strength — adjust if opponent is strong/weak
  if (opp && opp.winPct > 0) {
    prob -= (opp.winPct - 0.500) * 0.30; // facing .600 team → -0.03
  }

  // 3. Home/away split
  if (isHome && team.homeRecord) {
    const parts = team.homeRecord.split('-').map(Number);
    if (parts.length >= 2 && parts[0] + parts[1] >= 5) {
      const homePct = parts[0] / (parts[0] + parts[1]);
      prob += (homePct - 0.500) * 0.20;
    }
  } else if (!isHome && team.awayRecord) {
    const parts = team.awayRecord.split('-').map(Number);
    if (parts.length >= 2 && parts[0] + parts[1] >= 5) {
      const awayPct = parts[0] / (parts[0] + parts[1]);
      prob += (awayPct - 0.500) * 0.20;
    }
  }

  // 4. Streak momentum
  if (team.streak) {
    const match = team.streak.match(/^(W|L)(\d+)$/i);
    if (match) {
      const type = match[1].toUpperCase();
      const len = Math.min(parseInt(match[2]), 10); // cap influence at 10
      const streakBoost = (len / 10) * 0.06; // max +/- 6%
      prob += type === 'W' ? streakBoost : -streakBoost;
    }
  }

  // Clamp to reasonable range
  return Math.max(0.20, Math.min(0.80, prob));
}

/**
 * Calculate edges for a game using our model probability vs FanDuel odds.
 */
export function calculateEdges(game, teamStats = {}) {
  const markets = ['h2h', 'spreads', 'totals'];
  const edgeResults = [];

  // Use first bookmaker (FanDuel, since we only fetch that now)
  const book = game.bookmakers[0];
  if (!book) return edgeResults;

  for (const marketKey of markets) {
    const market = book.markets.find((m) => m.key === marketKey);
    if (!market) continue;

    const outcomes = market.outcomes;
    if (outcomes.length !== 2) continue;

    const { prob1, prob2 } = vigFreeProbs(outcomes[0].price, outcomes[1].price);
    const bookProbs = [prob1, prob2];

    outcomes.forEach((outcome, i) => {
      const isTeamBet = outcome.name !== 'Over' && outcome.name !== 'Under';
      const teamName = isTeamBet ? outcome.name : null;
      const opponentName = isTeamBet
        ? (outcome.name === game.home_team ? game.away_team : game.home_team)
        : null;
      const isHome = teamName === game.home_team;

      // Get confidence factors for display
      const { modifier, factors } = teamName
        ? confidenceModifier(teamName, isHome, teamStats)
        : { modifier: 1.0, factors: [] };

      let edgePct = 0;
      let modelProb = null;

      if (marketKey === 'h2h' && teamName) {
        // For moneyline: use our model probability directly
        modelProb = modelProbability(teamName, isHome, opponentName, teamStats);
        if (modelProb !== null) {
          edgePct = (modelProb - bookProbs[i]) * 100;
        }
      } else if (marketKey === 'spreads' && teamName) {
        // For spreads: model probability adjusts confidence in the spread
        modelProb = modelProbability(teamName, isHome, opponentName, teamStats);
        if (modelProb !== null) {
          // If our model thinks the team is stronger than the book implies,
          // they're more likely to cover the spread too
          edgePct = (modelProb - bookProbs[i]) * 100 * 0.7; // dampen for spreads
        }
      } else if (marketKey === 'totals') {
        // For totals: we don't have scoring data to model, so skip edge calc
        // but still show the line for reference
        edgePct = 0;
      }

      edgeResults.push({
        market: marketKey,
        book: book.key,
        bookTitle: book.title,
        outcomeName: outcome.name,
        point: outcome.point,
        price: outcome.price,
        impliedProb: bookProbs[i],
        modelProb,
        confidenceModifier: modifier,
        confidenceFactors: factors,
        edge: edgePct / 100,
        edgePct,
        adjustedEdgePct: edgePct, // already model-based, no separate adjustment
        edgeLevel: edgePct >= 5 ? 'high' : edgePct >= 3 ? 'moderate' : 'none',
        betterNumber: false,
      });
    });
  }

  return edgeResults;
}

export function getGameEdgeLevel(edges) {
  if (edges.some((e) => e.edgeLevel === 'high')) return 'high';
  if (edges.some((e) => e.edgeLevel === 'moderate')) return 'moderate';
  return 'none';
}

export function processGames(rawGames, teamStats = {}) {
  return rawGames.map((game) => {
    const edges = calculateEdges(game, teamStats);
    const edgeLevel = getGameEdgeLevel(edges);
    return { ...game, edges, edgeLevel };
  });
}
