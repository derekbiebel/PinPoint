"""
Sleeper API integration for NFL player data and weekly stats.
Sleeper's API is free and does not require authentication.
"""

import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://api.sleeper.app/v1"
TIMEOUT = 15


def fetch_players() -> dict[str, dict] | None:
    """
    Fetch all NFL players from Sleeper.
    Returns a dict keyed by player_id with player details.
    This is a large payload (~15MB) — cache results when possible.
    """
    try:
        url = f"{BASE_URL}/players/nfl"
        resp = requests.get(url, timeout=30)  # longer timeout for large payload
        resp.raise_for_status()
        players = resp.json()
        logger.info(f"Fetched {len(players)} players from Sleeper")
        return players
    except requests.RequestException as e:
        logger.error(f"Sleeper players request failed: {e}")
        return None
    except ValueError as e:
        logger.error(f"Sleeper players parse error: {e}")
        return None


def fetch_weekly_stats(season: int, week: int) -> dict[str, dict] | None:
    """
    Fetch weekly player stats from Sleeper.
    Returns dict keyed by player_id with stat breakdowns including:
    - target share proxy (rec_tgt)
    - air yards (rec_air_yd)
    - snap counts (when available)

    Note: Sleeper stats endpoint uses the projections/stats format.
    """
    try:
        url = f"{BASE_URL}/stats/nfl/regular/{season}/{week}"
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        stats = resp.json()
        logger.info(f"Fetched weekly stats for {season} week {week}: {len(stats)} players")
        return stats
    except requests.RequestException as e:
        logger.error(f"Sleeper weekly stats request failed: {e}")
        return None
    except ValueError as e:
        logger.error(f"Sleeper weekly stats parse error: {e}")
        return None


def fetch_weekly_projections(season: int, week: int) -> dict[str, dict] | None:
    """Fetch weekly projections from Sleeper."""
    try:
        url = f"{BASE_URL}/projections/nfl/regular/{season}/{week}"
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        projections = resp.json()
        logger.info(f"Fetched projections for {season} week {week}: {len(projections)} players")
        return projections
    except requests.RequestException as e:
        logger.error(f"Sleeper projections request failed: {e}")
        return None
    except ValueError as e:
        logger.error(f"Sleeper projections parse error: {e}")
        return None


def get_nfl_state() -> dict[str, Any] | None:
    """
    Get current NFL state from Sleeper (current week, season, etc.).
    Useful for determining what week/season we're in.
    """
    try:
        url = f"{BASE_URL}/state/nfl"
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        state = resp.json()
        logger.info(f"NFL state: season={state.get('season')}, week={state.get('week')}")
        return state
    except requests.RequestException as e:
        logger.error(f"Sleeper NFL state request failed: {e}")
        return None


def extract_player_stats(stats_data: dict[str, dict], players_data: dict[str, dict],
                         team: str) -> list[dict]:
    """
    Extract key stats for players on a specific team.
    Combines player info with weekly stats for analysis.

    Returns list of dicts with: name, position, targets, air_yards, snap_pct, etc.
    """
    if not stats_data or not players_data:
        return []

    team_stats = []
    for player_id, stats in stats_data.items():
        player = players_data.get(player_id, {})
        if player.get("team") != team:
            continue

        team_stats.append({
            "player_id": player_id,
            "name": player.get("full_name", "Unknown"),
            "position": player.get("position", ""),
            "team": team,
            "targets": stats.get("rec_tgt", 0),
            "receptions": stats.get("rec", 0),
            "air_yards": stats.get("rec_air_yd", 0),
            "receiving_yards": stats.get("rec_yd", 0),
            "rush_attempts": stats.get("rush_att", 0),
            "rush_yards": stats.get("rush_yd", 0),
            "pass_attempts": stats.get("pass_att", 0),
            "pass_yards": stats.get("pass_yd", 0),
            "pass_td": stats.get("pass_td", 0),
            "pass_int": stats.get("pass_int", 0),
            "snap_pct": stats.get("snp_pct", None),  # not always available
            "fantasy_points": stats.get("pts_ppr", 0),
        })

    return sorted(team_stats, key=lambda x: x.get("fantasy_points", 0), reverse=True)
