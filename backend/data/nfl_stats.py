"""
NFL play-by-play and stats via nfl_data_py.

Fetches EPA, CPOE, success rate, rosters, injuries, and schedules.
Computes team-level EPA per play with recency weighting.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Recency weights: last 4 weeks 40%, weeks 5-10 35%, earlier 25%
WEIGHT_RECENT = 0.40   # last 4 weeks
WEIGHT_MID = 0.35      # weeks 5-10
WEIGHT_EARLY = 0.25    # everything before week 5


def _safe_import_nfl():
    """Import nfl_data_py with graceful failure."""
    try:
        import nfl_data_py as nfl
        return nfl
    except ImportError:
        logger.error("nfl_data_py not installed. Run: pip install nfl_data_py")
        return None


def fetch_pbp(seasons: list[int]) -> pd.DataFrame | None:
    """
    Fetch play-by-play data for the given seasons.
    Returns a DataFrame with EPA, CPOE, success columns or None on failure.
    """
    nfl = _safe_import_nfl()
    if nfl is None:
        return None
    try:
        logger.info(f"Fetching play-by-play for seasons: {seasons}")
        pbp = nfl.import_pbp_data(seasons)
        logger.info(f"Fetched {len(pbp)} plays")
        return pbp
    except Exception as e:
        logger.error(f"Failed to fetch PBP data: {e}")
        return None


def fetch_weekly_stats(seasons: list[int]) -> pd.DataFrame | None:
    """Fetch weekly player stats."""
    nfl = _safe_import_nfl()
    if nfl is None:
        return None
    try:
        stats = nfl.import_weekly_data(seasons)
        logger.info(f"Fetched weekly stats: {len(stats)} rows")
        return stats
    except Exception as e:
        logger.error(f"Failed to fetch weekly stats: {e}")
        return None


def fetch_seasonal_stats(seasons: list[int]) -> pd.DataFrame | None:
    """Fetch seasonal aggregate stats."""
    nfl = _safe_import_nfl()
    if nfl is None:
        return None
    try:
        stats = nfl.import_seasonal_data(seasons)
        logger.info(f"Fetched seasonal stats: {len(stats)} rows")
        return stats
    except Exception as e:
        logger.error(f"Failed to fetch seasonal stats: {e}")
        return None


def fetch_rosters(seasons: list[int]) -> pd.DataFrame | None:
    """Fetch roster data for given seasons."""
    nfl = _safe_import_nfl()
    if nfl is None:
        return None
    try:
        rosters = nfl.import_rosters(seasons)
        logger.info(f"Fetched rosters: {len(rosters)} rows")
        return rosters
    except Exception as e:
        logger.error(f"Failed to fetch rosters: {e}")
        return None


def fetch_injuries(seasons: list[int]) -> pd.DataFrame | None:
    """Fetch injury report data."""
    nfl = _safe_import_nfl()
    if nfl is None:
        return None
    try:
        injuries = nfl.import_injuries(seasons)
        logger.info(f"Fetched injuries: {len(injuries)} rows")
        return injuries
    except Exception as e:
        logger.error(f"Failed to fetch injuries: {e}")
        return None


def fetch_schedule(seasons: list[int]) -> pd.DataFrame | None:
    """Fetch game schedule data."""
    nfl = _safe_import_nfl()
    if nfl is None:
        return None
    try:
        schedule = nfl.import_schedules(seasons)
        logger.info(f"Fetched schedule: {len(schedule)} rows")
        return schedule
    except Exception as e:
        logger.error(f"Failed to fetch schedule: {e}")
        return None


def compute_team_epa(pbp: pd.DataFrame, current_week: int | None = None) -> list[dict]:
    """
    Compute team-level EPA per play (offense and defense) with recency weighting.

    Recency buckets (relative to current_week):
        - Last 4 weeks: 40% weight
        - Weeks 5-10 back: 35% weight
        - Earlier: 25% weight

    Returns a list of dicts: [{team, season, week, off_epa, def_epa}, ...]
    """
    if pbp is None or pbp.empty:
        logger.warning("No PBP data to compute EPA from")
        return []

    # Filter to real plays (no nulls in EPA)
    plays = pbp.dropna(subset=["epa"]).copy()

    # Only pass and rush plays
    plays = plays[plays["play_type"].isin(["pass", "run"])].copy()

    if plays.empty:
        return []

    season = int(plays["season"].max())

    if current_week is None:
        current_week = int(plays["week"].max())

    # Assign recency weights based on distance from current week
    def _weight(week: int) -> float:
        weeks_ago = current_week - week
        if weeks_ago < 0:
            return 0.0
        if weeks_ago <= 3:  # last 4 weeks (0-3 weeks ago)
            return WEIGHT_RECENT
        elif weeks_ago <= 9:  # weeks 5-10 back (4-9 weeks ago)
            return WEIGHT_MID
        else:
            return WEIGHT_EARLY

    plays["recency_weight"] = plays["week"].apply(_weight)

    # -- Offensive EPA per play by team --
    off_groups = plays.groupby(["posteam", "week"])
    off_weekly = off_groups.apply(
        lambda g: pd.Series({
            "off_epa_raw": g["epa"].mean(),
            "plays": len(g),
            "weight": g["recency_weight"].iloc[0],
        }),
        include_groups=False,
    ).reset_index()

    off_weighted = off_weekly.groupby("posteam").apply(
        lambda g: np.average(g["off_epa_raw"], weights=g["weight"] * g["plays"])
        if g["weight"].sum() > 0 else 0.0,
        include_groups=False,
    )

    # -- Defensive EPA per play by team (lower is better) --
    def_groups = plays.groupby(["defteam", "week"])
    def_weekly = def_groups.apply(
        lambda g: pd.Series({
            "def_epa_raw": g["epa"].mean(),
            "plays": len(g),
            "weight": g["recency_weight"].iloc[0],
        }),
        include_groups=False,
    ).reset_index()

    def_weighted = def_weekly.groupby("defteam").apply(
        lambda g: np.average(g["def_epa_raw"], weights=g["weight"] * g["plays"])
        if g["weight"].sum() > 0 else 0.0,
        include_groups=False,
    )

    # Combine into ratings
    all_teams = set(off_weighted.index) | set(def_weighted.index)
    results = []
    for team in sorted(all_teams):
        off = float(off_weighted.get(team, 0.0))
        defe = float(def_weighted.get(team, 0.0))
        results.append({
            "team": team,
            "season": season,
            "week": current_week,
            "off_epa": round(off, 4),
            "def_epa": round(defe, 4),
        })

    logger.info(f"Computed EPA for {len(results)} teams, season {season} week {current_week}")
    return results


def get_success_rate(pbp: pd.DataFrame, team: str, side: str = "offense") -> float:
    """
    Calculate success rate for a team.
    Success = EPA > 0 on a play.
    side: 'offense' or 'defense'
    """
    if pbp is None or pbp.empty:
        return 0.0

    plays = pbp[pbp["play_type"].isin(["pass", "run"])].dropna(subset=["epa"])

    if side == "offense":
        team_plays = plays[plays["posteam"] == team]
    else:
        team_plays = plays[plays["defteam"] == team]

    if team_plays.empty:
        return 0.0

    return float((team_plays["epa"] > 0).mean())


def get_cpoe(pbp: pd.DataFrame, team: str) -> float:
    """Get average CPOE (completion probability over expectation) for a team's passes."""
    if pbp is None or pbp.empty:
        return 0.0

    passes = pbp[(pbp["posteam"] == team) & (pbp["play_type"] == "pass")].dropna(subset=["cpoe"])

    if passes.empty:
        return 0.0

    return float(passes["cpoe"].mean())
