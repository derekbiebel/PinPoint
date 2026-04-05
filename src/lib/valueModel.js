/**
 * Core value model — vig-free consensus probability calculations.
 * All pure functions, no side effects.
 */

const MIN_BOOKS_FOR_CONSENSUS = 3;

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
 * Build consensus across books for a given market.
 *
 * For spreads/totals, different books may offer different points
 * (e.g. -3.5 vs -4). We key consensus by outcome name only (team or
 * Over/Under), not by point, because the vig-free probability already
 * accounts for the point difference. This lets us detect value when a
 * book's line disagrees with the market.
 *
 * Also tracks the most common point (consensus line) and how many
 * books contributed, so we can require a minimum book threshold.
 */
export function buildConsensus(bookmakers, marketKey) {
  const outcomeTotals = {};
  const outcomeCounts = {};
  const outcomePoints = {}; // track point frequencies for consensus line

  for (const book of bookmakers) {
    const market = book.markets.find((m) => m.key === marketKey);
    if (!market) continue;

    const outcomes = market.outcomes;
    if (outcomes.length !== 2) continue;

    const { prob1, prob2 } = vigFreeProbs(outcomes[0].price, outcomes[1].price);
    const probs = [prob1, prob2];

    outcomes.forEach((outcome, i) => {
      // Key by name only — NOT by point
      const key = outcome.name;
      outcomeTotals[key] = (outcomeTotals[key] || 0) + probs[i];
      outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;

      // Track points for spreads/totals
      if (outcome.point !== undefined) {
        if (!outcomePoints[key]) outcomePoints[key] = {};
        outcomePoints[key][outcome.point] = (outcomePoints[key][outcome.point] || 0) + 1;
      }
    });
  }

  const consensus = {};
  for (const key of Object.keys(outcomeTotals)) {
    const count = outcomeCounts[key];
    // Require minimum books for a reliable consensus
    if (count < MIN_BOOKS_FOR_CONSENSUS) continue;

    const consensusPoint = outcomePoints[key]
      ? parseFloat(
          Object.entries(outcomePoints[key]).sort((a, b) => b[1] - a[1])[0][0]
        )
      : undefined;

    consensus[key] = {
      prob: outcomeTotals[key] / count,
      count,
      consensusPoint,
    };
  }
  return consensus;
}

export function calculateEdges(game) {
  const markets = ['h2h', 'spreads', 'totals'];
  const edgeResults = [];

  for (const marketKey of markets) {
    const consensus = buildConsensus(game.bookmakers, marketKey);

    for (const book of game.bookmakers) {
      const market = book.markets.find((m) => m.key === marketKey);
      if (!market) continue;

      const outcomes = market.outcomes;
      if (outcomes.length !== 2) continue;

      const { prob1, prob2 } = vigFreeProbs(outcomes[0].price, outcomes[1].price);
      const bookProbs = [prob1, prob2];

      outcomes.forEach((outcome, i) => {
        const key = outcome.name;
        const con = consensus[key];
        if (!con) return;

        const edge = con.prob - bookProbs[i];
        const edgePct = edge * 100;

        // For spreads/totals, flag if this book offers a better number
        let betterNumber = false;
        if (outcome.point !== undefined && con.consensusPoint !== undefined) {
          if (marketKey === 'spreads') {
            // Lower spread = better for the bettor (e.g. -3.5 better than -4)
            betterNumber = outcome.point > con.consensusPoint;
          } else if (marketKey === 'totals') {
            // For over: lower point = better. For under: higher point = better.
            betterNumber =
              outcome.name === 'Over'
                ? outcome.point < con.consensusPoint
                : outcome.point > con.consensusPoint;
          }
        }

        edgeResults.push({
          market: marketKey,
          book: book.key,
          bookTitle: book.title,
          outcomeName: outcome.name,
          point: outcome.point,
          consensusPoint: con.consensusPoint,
          price: outcome.price,
          impliedProb: bookProbs[i],
          consensusProb: con.prob,
          consensusBooks: con.count,
          edge,
          edgePct,
          edgeLevel: edgePct >= 5 ? 'high' : edgePct >= 3 ? 'moderate' : 'none',
          betterNumber,
        });
      });
    }
  }

  return edgeResults;
}

export function getGameEdgeLevel(edges) {
  if (edges.some((e) => e.edgeLevel === 'high')) return 'high';
  if (edges.some((e) => e.edgeLevel === 'moderate')) return 'moderate';
  return 'none';
}

export function detectMovement(currentOdds, historicalOdds, marketKey) {
  if (!historicalOdds) return null;

  if (marketKey === 'h2h') {
    const currentProb = impliedProb(currentOdds);
    const historicalProb = impliedProb(historicalOdds);
    const diff = currentProb - historicalProb;
    if (Math.abs(diff) >= 0.10) {
      return { direction: diff > 0 ? 'up' : 'down', magnitude: Math.abs(diff * 100) };
    }
  } else {
    const diff = Math.abs(currentOdds - historicalOdds);
    if (diff >= 1.5) {
      return { direction: currentOdds > historicalOdds ? 'up' : 'down', magnitude: diff };
    }
  }
  return null;
}

export function getBestOdds(bookmakers, marketKey, outcomeName, point) {
  let best = null;
  let bestBook = null;

  for (const book of bookmakers) {
    const market = book.markets.find((m) => m.key === marketKey);
    if (!market) continue;
    const outcome = market.outcomes.find((o) => {
      if (o.name !== outcomeName) return false;
      if (point !== undefined && o.point !== point) return false;
      return true;
    });
    if (!outcome) continue;
    if (best === null || outcome.price > best) {
      best = outcome.price;
      bestBook = book.title;
    }
  }
  return { price: best, book: bestBook };
}

export function processGames(rawGames) {
  return rawGames.map((game) => {
    const edges = calculateEdges(game);
    const edgeLevel = getGameEdgeLevel(edges);
    return { ...game, edges, edgeLevel };
  });
}
