/**
 * Model feedback system — analyzes resolved bet history to find
 * patterns where the edge model consistently loses, and generates
 * actionable insights.
 *
 * Segments bets by: sport, market, edge band, and book.
 * Flags segments that underperform after enough sample size.
 */

const MIN_SAMPLE = 8; // minimum resolved bets before judging a segment
const LOSS_RATE_THRESHOLD = 0.60; // flag if losing 60%+ of bets in a segment
const PROFIT_THRESHOLD = -3; // flag if segment P&L is worse than -$3 per bet

function segmentKey(parts) {
  return parts.join('|');
}

function edgeBand(edgePct) {
  if (edgePct >= 7) return '7%+';
  if (edgePct >= 5) return '5-7%';
  if (edgePct >= 3) return '3-5%';
  return '<3%';
}

const SPORT_LABELS = {
  americanfootball_nfl: 'NFL',
  basketball_nba: 'NBA',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
};

const MARKET_LABELS = {
  h2h: 'Moneyline',
  spreads: 'Spreads',
  totals: 'Totals',
};

function analyzeSegment(bets, label, segType) {
  const resolved = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  if (resolved.length < MIN_SAMPLE) return null;

  const wins = resolved.filter((b) => b.status === 'won').length;
  const losses = resolved.length - wins;
  const winRate = wins / resolved.length;
  const lossRate = losses / resolved.length;
  const totalProfit = resolved.reduce((sum, b) => sum + (b.profit || 0), 0);
  const profitPerBet = totalProfit / resolved.length;
  const avgEdge = resolved.reduce((sum, b) => sum + b.edgePct, 0) / resolved.length;

  // Expected win rate based on average consensus probability of the bets
  // (We don't store consensus prob on bets, so estimate from edge + implied)
  // A positive edge means consensus thinks we should win more often than the book implies

  const result = {
    label,
    segType,
    total: resolved.length,
    wins,
    losses,
    winRate,
    lossRate,
    totalProfit,
    profitPerBet,
    avgEdge,
    pending: bets.filter((b) => b.status === 'pending').length,
  };

  // Determine status
  if (lossRate >= LOSS_RATE_THRESHOLD && profitPerBet < PROFIT_THRESHOLD) {
    result.status = 'danger';
    result.message = `Losing ${(lossRate * 100).toFixed(0)}% of bets (${losses}/${resolved.length}), avg ${profitPerBet >= 0 ? '+' : ''}$${profitPerBet.toFixed(2)}/bet`;
  } else if (lossRate >= 0.55 && totalProfit < 0) {
    result.status = 'warning';
    result.message = `Slight losing trend: ${(lossRate * 100).toFixed(0)}% loss rate, $${totalProfit.toFixed(2)} total`;
  } else if (winRate >= 0.55 && totalProfit > 0) {
    result.status = 'strong';
    result.message = `Winning ${(winRate * 100).toFixed(0)}% (${wins}/${resolved.length}), +$${totalProfit.toFixed(2)} total`;
  } else {
    result.status = 'neutral';
    result.message = `${(winRate * 100).toFixed(0)}% win rate (${wins}/${resolved.length}), $${totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)} total`;
  }

  return result;
}

function groupBets(bets, keyFn) {
  const groups = {};
  for (const bet of bets) {
    const key = keyFn(bet);
    if (!groups[key]) groups[key] = [];
    groups[key].push(bet);
  }
  return groups;
}

export function generateInsights(bets) {
  if (bets.length === 0) return { segments: [], suggestions: [], overall: null };

  const segments = [];
  const suggestions = [];

  // Overall
  const overall = analyzeSegment(bets, 'All Bets', 'overall');

  // By sport
  const bySport = groupBets(bets, (b) => b.sportKey);
  for (const [sport, sportBets] of Object.entries(bySport)) {
    const result = analyzeSegment(sportBets, SPORT_LABELS[sport] || sport, 'sport');
    if (result) segments.push(result);
  }

  // By market
  const byMarket = groupBets(bets, (b) => b.market);
  for (const [market, marketBets] of Object.entries(byMarket)) {
    const result = analyzeSegment(marketBets, MARKET_LABELS[market] || market, 'market');
    if (result) segments.push(result);
  }

  // By edge band
  const byEdge = groupBets(bets, (b) => edgeBand(b.edgePct));
  for (const [band, bandBets] of Object.entries(byEdge)) {
    const result = analyzeSegment(bandBets, `Edge ${band}`, 'edge');
    if (result) segments.push(result);
  }

  // By book
  const byBook = groupBets(bets, (b) => b.book);
  for (const [book, bookBets] of Object.entries(byBook)) {
    const result = analyzeSegment(bookBets, book, 'book');
    if (result) segments.push(result);
  }

  // Cross-segments: sport × market (the most useful combo)
  for (const [sport, sportBets] of Object.entries(bySport)) {
    const byMarketInSport = groupBets(sportBets, (b) => b.market);
    for (const [market, crossBets] of Object.entries(byMarketInSport)) {
      const label = `${SPORT_LABELS[sport] || sport} ${MARKET_LABELS[market] || market}`;
      const result = analyzeSegment(crossBets, label, 'cross');
      if (result) segments.push(result);
    }
  }

  // Generate suggestions from danger/warning segments
  const dangerSegments = segments.filter((s) => s.status === 'danger');
  const warningSegments = segments.filter((s) => s.status === 'warning');
  const strongSegments = segments.filter((s) => s.status === 'strong');

  for (const seg of dangerSegments) {
    if (seg.segType === 'edge' && seg.label.includes('3-5%')) {
      suggestions.push({
        type: 'raise_threshold',
        severity: 'danger',
        text: `Moderate edge bets (3-5%) are losing badly. Consider raising the minimum edge threshold to 5%.`,
        segment: seg,
      });
    } else if (seg.segType === 'market') {
      suggestions.push({
        type: 'avoid_market',
        severity: 'danger',
        text: `${seg.label} bets are consistently losing. The consensus model may not work well for this market type.`,
        segment: seg,
      });
    } else if (seg.segType === 'sport') {
      suggestions.push({
        type: 'avoid_sport',
        severity: 'danger',
        text: `${seg.label} bets are underwater. Consider disabling this sport or requiring higher edges.`,
        segment: seg,
      });
    } else if (seg.segType === 'book') {
      suggestions.push({
        type: 'suspect_book',
        severity: 'danger',
        text: `${seg.label} edges consistently lose — their "off" lines may be intentional, not mispriced.`,
        segment: seg,
      });
    } else if (seg.segType === 'cross') {
      suggestions.push({
        type: 'avoid_cross',
        severity: 'danger',
        text: `${seg.label} is a losing combo. Consider skipping this specific segment.`,
        segment: seg,
      });
    }
  }

  for (const seg of warningSegments) {
    suggestions.push({
      type: 'watch',
      severity: 'warning',
      text: `${seg.label}: slight losing trend (${seg.total} bets). Keep watching.`,
      segment: seg,
    });
  }

  // Sort: danger first, then warnings
  suggestions.sort((a, b) => {
    const order = { danger: 0, warning: 1 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  return { segments, suggestions, overall };
}
