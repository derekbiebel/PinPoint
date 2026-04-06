"""
Core power ratings model.

Converts EPA per play into predicted spreads and totals,
with adjustments for home field, rest, schedule, injuries, and weather.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------- Constants ----------

# EPA to points scaling: EPA * multiplier * plays_per_game
EPA_MULTIPLIER = 2.5
PLAYS_PER_GAME = 63  # league average plays per game per team

# Home-field advantage in points
HOME_FIELD_ADV = 2.5

# Rest differential: +1.0 per extra day of rest, capped at +3.0
REST_PER_DAY = 1.0
REST_CAP = 3.0

# Short week penalty (Thursday game after Sunday)
SHORT_WEEK_PENALTY = -1.5

# Divisional game compression: compress spread by 15%
DIVISIONAL_COMPRESS = 0.15

# Average total for baseline
LEAGUE_AVG_TOTAL = 45.0

# Divisions for divisional matchup detection
NFL_DIVISIONS = {
    "AFC East": ["BUF", "MIA", "NE", "NYJ"],
    "AFC North": ["BAL", "CIN", "CLE", "PIT"],
    "AFC South": ["HOU", "IND", "JAX", "TEN"],
    "AFC West": ["DEN", "KC", "LAC", "LV"],
    "NFC East": ["DAL", "NYG", "PHI", "WAS"],
    "NFC North": ["CHI", "DET", "GB", "MIN"],
    "NFC South": ["ATL", "CAR", "NO", "TB"],
    "NFC West": ["ARI", "LAR", "SEA", "SF"],
}


def _team_to_division(team: str) -> str | None:
    """Look up which division a team belongs to."""
    for div, teams in NFL_DIVISIONS.items():
        if team in teams:
            return div
    return None


def _is_divisional(home: str, away: str) -> bool:
    """Check if two teams are in the same division."""
    home_div = _team_to_division(home)
    return home_div is not None and home_div == _team_to_division(away)


def _epa_to_points(epa_per_play: float) -> float:
    """Convert EPA per play to estimated points contribution."""
    return epa_per_play * EPA_MULTIPLIER * PLAYS_PER_GAME


def _rest_adjustment(home_rest_days: int, away_rest_days: int) -> float:
    """
    Calculate rest differential adjustment (from home team perspective).
    Positive = home advantage, negative = away advantage.
    """
    diff = home_rest_days - away_rest_days
    adj = diff * REST_PER_DAY
    return max(-REST_CAP, min(REST_CAP, adj))


def _injury_adjustment(injuries: list[dict] | None, team: str,
                        rosters: list[dict] | None = None) -> float:
    """
    Estimate points adjustment based on injury report.
    Uses snap-weighted EPA: key players missing = bigger penalty.

    Simplified approach:
        - QB out: -4.0 points
        - Other starter out: -0.5 to -1.5 based on position
    """
    if not injuries:
        return 0.0

    adjustment = 0.0
    team_injuries = [i for i in injuries if i.get("team") == team
                     and i.get("status") in ("Out", "Doubtful")]

    # Position impact weights
    position_impact = {
        "QB": -4.0,
        "LT": -1.5, "RT": -1.0, "LG": -0.5, "RG": -0.5, "C": -0.8,
        "WR": -1.0, "TE": -0.5, "RB": -0.5,
        "DE": -1.0, "DT": -0.8, "OLB": -0.8, "ILB": -0.5, "MLB": -0.5,
        "CB": -1.2, "S": -0.8, "FS": -0.8, "SS": -0.8,
        "K": -0.5, "P": -0.2,
    }

    for inj in team_injuries:
        pos = inj.get("position", "")
        impact = position_impact.get(pos, -0.3)
        adjustment += impact

    return adjustment


def compute_power_ratings(
    team_epa: list[dict],
    injuries: list[dict] | None = None,
    rosters: list[dict] | None = None,
) -> list[dict]:
    """
    Compute composite power ratings for all teams.

    Each team gets:
        - off_points: offensive EPA scaled to points
        - def_points: defensive EPA scaled to points (negative = good defense)
        - composite_rating: off_points - def_points + injury adj

    Args:
        team_epa: List from nfl_stats.compute_team_epa()
        injuries: List of injury dicts (optional)
        rosters: List of roster dicts (optional)

    Returns:
        Updated team_epa list with composite_rating added.
    """
    if not team_epa:
        logger.warning("No team EPA data to compute ratings from")
        return []

    for team in team_epa:
        off_pts = _epa_to_points(team["off_epa"])
        inj_adj = _injury_adjustment(injuries, team["team"], rosters)

        # Composite based on offensive EPA only — we don't have reliable
        # defensive player stats from nfl_data_py seasonal data
        composite = off_pts + inj_adj
        team["composite_rating"] = round(composite, 2)

    # Sort by composite rating descending
    team_epa.sort(key=lambda t: t["composite_rating"], reverse=True)

    logger.info(f"Computed power ratings for {len(team_epa)} teams")
    if team_epa:
        logger.info(f"Top 3: {[(t['team'], t['composite_rating']) for t in team_epa[:3]]}")

    return team_epa


def predict_game(
    home_rating: dict,
    away_rating: dict,
    home_rest_days: int = 7,
    away_rest_days: int = 7,
    injuries: list[dict] | None = None,
    weather_adj: float = 0.0,
    is_short_week: bool = False,
) -> dict:
    """
    Predict spread and total for a single game.

    Args:
        home_rating: Team rating dict with off_epa, def_epa, composite_rating
        away_rating: Team rating dict
        home_rest_days: Days since home team's last game
        away_rest_days: Days since away team's last game
        injuries: Injury list for adjustment
        weather_adj: Points adjustment from weather (negative = lower total)
        is_short_week: Whether this is a short-week game

    Returns:
        {model_spread, model_total, adjustments}
    """
    home_team = home_rating["team"]
    away_team = away_rating["team"]

    # Raw spread from composite ratings (positive = home favored)
    raw_spread = (home_rating["composite_rating"] - away_rating["composite_rating"]) / 2

    # Apply home-field advantage
    spread = raw_spread + HOME_FIELD_ADV

    # Rest adjustment
    rest_adj = _rest_adjustment(home_rest_days, away_rest_days)
    spread += rest_adj

    # Short week
    short_week_adj = 0.0
    if is_short_week:
        short_week_adj = SHORT_WEEK_PENALTY
        spread += short_week_adj

    # Divisional compression
    divisional = _is_divisional(home_team, away_team)
    if divisional:
        spread *= (1 - DIVISIONAL_COMPRESS)

    # Predicted total: league average + offensive contributions - defensive strengths
    home_off = _epa_to_points(home_rating["off_epa"])
    away_off = _epa_to_points(away_rating["off_epa"])
    home_def = _epa_to_points(home_rating["def_epa"])
    away_def = _epa_to_points(away_rating["def_epa"])

    # Total = baseline + (home offense vs away defense) + (away offense vs home defense)
    total = LEAGUE_AVG_TOTAL + (home_off - away_def) / 2 + (away_off - home_def) / 2
    total += weather_adj

    return {
        "home_team": home_team,
        "away_team": away_team,
        "model_spread": round(spread, 1),
        "model_total": round(total, 1),
        "adjustments": {
            "home_field": HOME_FIELD_ADV,
            "rest": round(rest_adj, 1),
            "short_week": short_week_adj,
            "divisional": divisional,
            "weather": weather_adj,
        },
    }
