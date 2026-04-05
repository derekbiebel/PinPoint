/**
 * Core value model — vig-free consensus probability calculations.
 * All pure functions, no side effects.
 */

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

export function buildConsensus(bookmakers, marketKey) {
  const outcomeTotals = {};
  const outcomeCounts = {};

  for (const book of bookmakers) {
    const market = book.markets.find((m) => m.key === marketKey);
    if (!market) continue;

    const outcomes = market.outcomes;
    if (marketKey === 'h2h' && outcomes.length === 2) {
      const { prob1, prob2 } = vigFreeProbs(outcomes[0].price, outcomes[1].price);
      const key0 = outcomes[0].name;
      const key1 = outcomes[1].name;
      outcomeTotals[key0] = (outcomeTotals[key0] || 0) + prob1;
      outcomeCounts[key0] = (outcomeCounts[key0] || 0) + 1;
      outcomeTotals[key1] = (outcomeTotals[key1] || 0) + prob2;
      outcomeCounts[key1] = (outcomeCounts[key1] || 0) + 1;
    } else if ((marketKey === 'spreads' || marketKey === 'totals') && outcomes.length === 2) {
      const { prob1, prob2 } = vigFreeProbs(outcomes[0].price, outcomes[1].price);
      const key0 = `${outcomes[0].name}|${outcomes[0].point}`;
      const key1 = `${outcomes[1].name}|${outcomes[1].point}`;
      outcomeTotals[key0] = (outcomeTotals[key0] || 0) + prob1;
      outcomeCounts[key0] = (outcomeCounts[key0] || 0) + 1;
      outcomeTotals[key1] = (outcomeTotals[key1] || 0) + prob2;
      outcomeCounts[key1] = (outcomeCounts[key1] || 0) + 1;
    }
  }

  const consensus = {};
  for (const key of Object.keys(outcomeTotals)) {
    consensus[key] = outcomeTotals[key] / outcomeCounts[key];
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
        const outcomeKey =
          marketKey === 'h2h' ? outcome.name : `${outcome.name}|${outcome.point}`;
        const consensusProb = consensus[outcomeKey];
        if (consensusProb == null) return;

        const edge = consensusProb - bookProbs[i];
        const edgePct = edge * 100;

        edgeResults.push({
          market: marketKey,
          book: book.key,
          bookTitle: book.title,
          outcomeName: outcome.name,
          point: outcome.point,
          price: outcome.price,
          impliedProb: bookProbs[i],
          consensusProb,
          edge,
          edgePct,
          edgeLevel: edgePct >= 5 ? 'high' : edgePct >= 3 ? 'moderate' : 'none',
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
