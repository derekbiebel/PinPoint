"""
Edge calculation and classification.

Compares model predictions to FanDuel lines to find betting value.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Edge tier thresholds (absolute value of gap in points)
HIGH_EDGE = 3.0
MODERATE_EDGE = 1.5


def calculate_spread_edge(
    model_spread: float,
    fd_spread: float | None,
    fd_juice: int | None = -110,
) -> dict:
    """
    Calculate the edge on the spread.

    Convention: negative spread = home favored.
    Edge = model_spread - fd_spread (positive = value on home team covering).

    Args:
        model_spread: Model's predicted spread (negative = home favored)
        fd_spread: FanDuel's posted spread
        fd_juice: FanDuel vig (e.g., -110)

    Returns:
        {edge, direction, tier, description}
    """
    if fd_spread is None:
        return {"edge": None, "direction": None, "tier": "none", "description": "No FanDuel line available"}

    # Gap: how much does the model disagree with FanDuel?
    # If model says -7 and FD says -3, gap = -4 (model sees home as bigger favorite)
    gap = model_spread - fd_spread

    tier = classify_edge(gap)

    # Direction: which side has value?
    if gap < -MODERATE_EDGE:
        direction = "HOME"
        desc = f"Model favors home by {abs(gap):.1f} more than FanDuel"
    elif gap > MODERATE_EDGE:
        direction = "AWAY"
        desc = f"Model favors away by {abs(gap):.1f} more than FanDuel"
    else:
        direction = "NONE"
        desc = f"Model and FanDuel within {abs(gap):.1f} points"

    return {
        "edge": round(gap, 1),
        "direction": direction,
        "tier": tier,
        "description": desc,
    }


def calculate_total_edge(
    model_total: float,
    fd_total: float | None,
    fd_juice: int | None = -110,
) -> dict:
    """
    Calculate the edge on the total (over/under).

    Edge = model_total - fd_total (positive = model sees higher scoring).

    Args:
        model_total: Model's predicted game total
        fd_total: FanDuel's posted total
        fd_juice: FanDuel vig

    Returns:
        {edge, direction, tier, description}
    """
    if fd_total is None:
        return {"edge": None, "direction": None, "tier": "none", "description": "No FanDuel total available"}

    gap = model_total - fd_total
    tier = classify_edge(gap)

    if gap > MODERATE_EDGE:
        direction = "OVER"
        desc = f"Model total {abs(gap):.1f} higher than FanDuel (lean over)"
    elif gap < -MODERATE_EDGE:
        direction = "UNDER"
        desc = f"Model total {abs(gap):.1f} lower than FanDuel (lean under)"
    else:
        direction = "NONE"
        desc = f"Model and FanDuel totals within {abs(gap):.1f} points"

    return {
        "edge": round(gap, 1),
        "direction": direction,
        "tier": tier,
        "description": desc,
    }


def classify_edge(gap: float) -> str:
    """
    Classify edge magnitude into tiers.

    Args:
        gap: Absolute or signed difference in points.

    Returns:
        "high", "moderate", or "none"
    """
    abs_gap = abs(gap)
    if abs_gap >= HIGH_EDGE:
        return "high"
    elif abs_gap >= MODERATE_EDGE:
        return "moderate"
    else:
        return "none"


def compute_game_edges(
    model_spread: float,
    model_total: float,
    fd_spread: float | None,
    fd_total: float | None,
) -> dict:
    """
    Convenience: compute both spread and total edges for a game.

    Returns combined dict with spread_edge, total_edge, and overall edge_tier.
    """
    spread = calculate_spread_edge(model_spread, fd_spread)
    total = calculate_total_edge(model_total, fd_total)

    # Overall tier: highest of spread or total
    tiers = {"high": 3, "moderate": 2, "none": 1}
    tier_vals = [tiers.get(spread["tier"], 0), tiers.get(total["tier"], 0)]
    max_tier = max(tier_vals)
    overall_tier = {3: "high", 2: "moderate", 1: "none"}.get(max_tier, "none")

    return {
        "spread_edge": spread["edge"],
        "total_edge": total["edge"],
        "spread_direction": spread["direction"],
        "total_direction": total["direction"],
        "spread_tier": spread["tier"],
        "total_tier": total["tier"],
        "edge_tier": overall_tier,
        "spread_description": spread["description"],
        "total_description": total["description"],
    }
