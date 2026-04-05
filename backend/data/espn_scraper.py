"""
ESPN API integration for injuries, rosters, and schedule data.
Uses the public sports.core.api.espn.com endpoints.
"""

import logging
from typing import Any

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
CORE_URL = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"

# ESPN team ID -> abbreviation mapping
ESPN_TEAM_IDS = {
    1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN",
    8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR",
    15: "MIA", 16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ",
    21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF", 26: "SEA",
    27: "TB", 28: "WAS", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU",
}

TIMEOUT = 15


def fetch_injuries() -> list[dict]:
    """
    Fetch current NFL injury data from ESPN.
    Returns a list of dicts with player name, team, status, and injury details.
    """
    injuries = []
    try:
        # ESPN injuries endpoint
        url = f"{BASE_URL}/injuries"
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        for team_entry in data.get("items", []):
            team_info = team_entry.get("team", {})
            team_abbr = team_info.get("abbreviation", "UNK")

            for player_injury in team_entry.get("injuries", []):
                athlete = player_injury.get("athlete", {})
                injuries.append({
                    "player_name": athlete.get("displayName", "Unknown"),
                    "player_id": athlete.get("id"),
                    "team": team_abbr,
                    "position": athlete.get("position", {}).get("abbreviation", ""),
                    "status": player_injury.get("status", "Unknown"),
                    "injury_type": player_injury.get("type", {}).get("description", ""),
                    "detail": player_injury.get("details", {}).get("detail", ""),
                })

        logger.info(f"Fetched {len(injuries)} injury records from ESPN")

    except requests.RequestException as e:
        logger.error(f"ESPN injuries request failed: {e}")
    except (KeyError, ValueError) as e:
        logger.error(f"ESPN injuries parse error: {e}")

    return injuries


def fetch_rosters(team_id: int) -> list[dict]:
    """
    Fetch the roster for a specific team by ESPN team ID.
    Returns a list of player dicts.
    """
    players = []
    try:
        url = f"{BASE_URL}/teams/{team_id}/roster"
        resp = requests.get(url, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        team_abbr = ESPN_TEAM_IDS.get(team_id, "UNK")

        for group in data.get("athletes", []):
            for athlete in group.get("items", []):
                players.append({
                    "player_id": athlete.get("id"),
                    "name": athlete.get("displayName", "Unknown"),
                    "team": team_abbr,
                    "position": athlete.get("position", {}).get("abbreviation", ""),
                    "jersey": athlete.get("jersey", ""),
                    "age": athlete.get("age"),
                    "experience": athlete.get("experience", {}).get("years", 0),
                    "status": athlete.get("status", {}).get("type", ""),
                })

        logger.info(f"Fetched {len(players)} players for team {team_abbr}")

    except requests.RequestException as e:
        logger.error(f"ESPN roster request failed for team {team_id}: {e}")
    except (KeyError, ValueError) as e:
        logger.error(f"ESPN roster parse error for team {team_id}: {e}")

    return players


def fetch_all_rosters() -> dict[str, list[dict]]:
    """Fetch rosters for all 32 teams. Returns {team_abbr: [players]}."""
    all_rosters = {}
    for team_id, abbr in ESPN_TEAM_IDS.items():
        roster = fetch_rosters(team_id)
        if roster:
            all_rosters[abbr] = roster
    return all_rosters


def fetch_schedule(season_year: int | None = None, week: int | None = None) -> list[dict]:
    """
    Fetch NFL schedule/scoreboard from ESPN.
    Returns a list of game dicts.
    """
    games = []
    try:
        url = f"{BASE_URL}/scoreboard"
        params: dict[str, Any] = {}
        if season_year is not None:
            params["dates"] = str(season_year)
        if week is not None:
            params["week"] = week

        resp = requests.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        for event in data.get("events", []):
            competition = event.get("competitions", [{}])[0]
            competitors = competition.get("competitors", [])

            home = away = None
            for comp in competitors:
                team_data = {
                    "team": comp.get("team", {}).get("abbreviation", ""),
                    "score": comp.get("score"),
                    "team_id": comp.get("team", {}).get("id"),
                }
                if comp.get("homeAway") == "home":
                    home = team_data
                else:
                    away = team_data

            if home and away:
                games.append({
                    "game_id": event.get("id"),
                    "name": event.get("name", ""),
                    "date": event.get("date"),
                    "home_team": home["team"],
                    "away_team": away["team"],
                    "home_score": home["score"],
                    "away_score": away["score"],
                    "status": event.get("status", {}).get("type", {}).get("description", ""),
                    "week": event.get("week", {}).get("number"),
                })

        logger.info(f"Fetched {len(games)} games from ESPN scoreboard")

    except requests.RequestException as e:
        logger.error(f"ESPN schedule request failed: {e}")
    except (KeyError, ValueError) as e:
        logger.error(f"ESPN schedule parse error: {e}")

    return games
