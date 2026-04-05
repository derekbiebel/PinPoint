"""
FanDuel odds via The Odds API.
Fetches spreads, totals, moneylines, and futures for NFL games.
"""

import logging
import os
from typing import Any

import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://api.the-odds-api.com/v4"
SPORT = "americanfootball_nfl"
TIMEOUT = 15

# Track remaining API requests globally
_requests_remaining: int | None = None


def _get_api_key() -> str | None:
    """Get The Odds API key from environment."""
    key = os.getenv("ODDS_API_KEY")
    if not key or key.startswith("your_"):
        logger.warning("ODDS_API_KEY not set; odds fetching disabled")
        return None
    return key


def _log_remaining(response: requests.Response) -> None:
    """Log x-requests-remaining header from The Odds API."""
    global _requests_remaining
    remaining = response.headers.get("x-requests-remaining")
    if remaining is not None:
        _requests_remaining = int(remaining)
        used = response.headers.get("x-requests-used", "?")
        logger.info(f"Odds API: {used} used, {remaining} remaining")


def get_requests_remaining() -> int | None:
    """Return the last known requests-remaining count."""
    return _requests_remaining


def fetch_nfl_odds(api_key: str | None = None) -> list[dict]:
    """
    Fetch current NFL game odds (h2h, spreads, totals) from FanDuel.

    Returns a list of game dicts, each containing:
        - id, sport, commence_time, home_team, away_team
        - fd_spread, fd_total (extracted from FanDuel bookmaker)
    """
    key = api_key or _get_api_key()
    if not key:
        return []

    try:
        url = f"{BASE_URL}/sports/{SPORT}/odds"
        params = {
            "apiKey": key,
            "regions": "us",
            "markets": "h2h,spreads,totals",
            "bookmakers": "fanduel",
            "oddsFormat": "american",
        }

        resp = requests.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        _log_remaining(resp)

        raw_games = resp.json()
        games = []

        for game in raw_games:
            parsed = {
                "id": game.get("id"),
                "sport": game.get("sport_key"),
                "commence_time": game.get("commence_time"),
                "home_team": game.get("home_team"),
                "away_team": game.get("away_team"),
                "fd_spread": None,
                "fd_total": None,
                "fd_home_ml": None,
                "fd_away_ml": None,
                "fd_spread_price": None,
                "fd_total_price": None,
            }

            # Extract FanDuel-specific lines
            for bookmaker in game.get("bookmakers", []):
                if bookmaker.get("key") != "fanduel":
                    continue

                for market in bookmaker.get("markets", []):
                    outcomes = market.get("outcomes", [])
                    market_key = market.get("key")

                    if market_key == "spreads":
                        for o in outcomes:
                            if o.get("name") == game.get("home_team"):
                                parsed["fd_spread"] = o.get("point")
                                parsed["fd_spread_price"] = o.get("price")

                    elif market_key == "totals":
                        for o in outcomes:
                            if o.get("name") == "Over":
                                parsed["fd_total"] = o.get("point")
                                parsed["fd_total_price"] = o.get("price")

                    elif market_key == "h2h":
                        for o in outcomes:
                            if o.get("name") == game.get("home_team"):
                                parsed["fd_home_ml"] = o.get("price")
                            else:
                                parsed["fd_away_ml"] = o.get("price")

            games.append(parsed)

        logger.info(f"Fetched odds for {len(games)} NFL games")
        return games

    except requests.RequestException as e:
        logger.error(f"Odds API request failed: {e}")
        return []
    except (KeyError, ValueError) as e:
        logger.error(f"Odds API parse error: {e}")
        return []


def fetch_nfl_futures(api_key: str | None = None) -> list[dict]:
    """
    Fetch NFL futures (win totals) from FanDuel via The Odds API.

    Returns a list of dicts: [{team, fd_win_total}, ...]
    """
    key = api_key or _get_api_key()
    if not key:
        return []

    futures = []

    # Try win totals market
    for market_sport in ["americanfootball_nfl_season_wins"]:
        try:
            url = f"{BASE_URL}/sports/{market_sport}/odds"
            params = {
                "apiKey": key,
                "regions": "us",
                "markets": "totals",
                "bookmakers": "fanduel",
                "oddsFormat": "american",
            }

            resp = requests.get(url, params=params, timeout=TIMEOUT)
            _log_remaining(resp)

            if resp.status_code == 404:
                logger.info(f"Futures market {market_sport} not available")
                continue

            resp.raise_for_status()
            raw = resp.json()

            for event in raw:
                team_name = event.get("home_team", "")
                for bookmaker in event.get("bookmakers", []):
                    if bookmaker.get("key") != "fanduel":
                        continue
                    for market in bookmaker.get("markets", []):
                        for outcome in market.get("outcomes", []):
                            if outcome.get("name") == "Over":
                                futures.append({
                                    "team": team_name,
                                    "fd_win_total": outcome.get("point"),
                                })

            logger.info(f"Fetched {len(futures)} futures lines")

        except requests.RequestException as e:
            logger.error(f"Futures API request failed: {e}")
        except (KeyError, ValueError) as e:
            logger.error(f"Futures API parse error: {e}")

    return futures


# Full team name to abbreviation mapping for odds API
TEAM_NAME_TO_ABBR = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
    "Los Angeles Rams": "LAR", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
    "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
    "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
    "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
}


def normalize_team_name(full_name: str) -> str:
    """Convert a full team name to its standard abbreviation."""
    return TEAM_NAME_TO_ABBR.get(full_name, full_name)
