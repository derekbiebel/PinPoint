"""
Weather data for NFL games via OpenWeatherMap API.
Includes stadium coordinates and weather-based scoring adjustments.
"""

import logging
import os
from datetime import datetime
from typing import Any

import requests

logger = logging.getLogger(__name__)

TIMEOUT = 10

# Stadium coordinates and dome info for all 32 NFL teams.
# dome: True = fixed dome/indoor, "retractable" = retractable roof
STADIUMS: dict[str, dict[str, Any]] = {
    "ARI": {"name": "State Farm Stadium", "lat": 33.5276, "lon": -112.2626, "dome": "retractable"},
    "ATL": {"name": "Mercedes-Benz Stadium", "lat": 33.7554, "lon": -84.4010, "dome": "retractable"},
    "BAL": {"name": "M&T Bank Stadium", "lat": 39.2780, "lon": -76.6227, "dome": False},
    "BUF": {"name": "Highmark Stadium", "lat": 42.7738, "lon": -78.7870, "dome": False},
    "CAR": {"name": "Bank of America Stadium", "lat": 35.2258, "lon": -80.8528, "dome": False},
    "CHI": {"name": "Soldier Field", "lat": 41.8623, "lon": -87.6167, "dome": False},
    "CIN": {"name": "Paycor Stadium", "lat": 39.0955, "lon": -84.5161, "dome": False},
    "CLE": {"name": "Cleveland Browns Stadium", "lat": 41.5061, "lon": -81.6995, "dome": False},
    "DAL": {"name": "AT&T Stadium", "lat": 32.7480, "lon": -97.0929, "dome": "retractable"},
    "DEN": {"name": "Empower Field at Mile High", "lat": 39.7439, "lon": -105.0201, "dome": False},
    "DET": {"name": "Ford Field", "lat": 42.3400, "lon": -83.0456, "dome": True},
    "GB":  {"name": "Lambeau Field", "lat": 44.5013, "lon": -88.0622, "dome": False},
    "HOU": {"name": "NRG Stadium", "lat": 29.6847, "lon": -95.4107, "dome": "retractable"},
    "IND": {"name": "Lucas Oil Stadium", "lat": 39.7601, "lon": -86.1639, "dome": "retractable"},
    "JAX": {"name": "EverBank Stadium", "lat": 30.3240, "lon": -81.6373, "dome": False},
    "KC":  {"name": "GEHA Field at Arrowhead", "lat": 39.0489, "lon": -94.4839, "dome": False},
    "LAC": {"name": "SoFi Stadium", "lat": 33.9535, "lon": -118.3392, "dome": True},
    "LAR": {"name": "SoFi Stadium", "lat": 33.9535, "lon": -118.3392, "dome": True},
    "LV":  {"name": "Allegiant Stadium", "lat": 36.0909, "lon": -115.1833, "dome": True},
    "MIA": {"name": "Hard Rock Stadium", "lat": 25.9580, "lon": -80.2389, "dome": False},
    "MIN": {"name": "U.S. Bank Stadium", "lat": 44.9736, "lon": -93.2575, "dome": True},
    "NE":  {"name": "Gillette Stadium", "lat": 42.0909, "lon": -71.2643, "dome": False},
    "NO":  {"name": "Caesars Superdome", "lat": 29.9511, "lon": -90.0812, "dome": True},
    "NYG": {"name": "MetLife Stadium", "lat": 40.8128, "lon": -74.0742, "dome": False},
    "NYJ": {"name": "MetLife Stadium", "lat": 40.8128, "lon": -74.0742, "dome": False},
    "PHI": {"name": "Lincoln Financial Field", "lat": 39.9008, "lon": -75.1675, "dome": False},
    "PIT": {"name": "Acrisure Stadium", "lat": 40.4468, "lon": -80.0158, "dome": False},
    "SEA": {"name": "Lumen Field", "lat": 47.5952, "lon": -122.3316, "dome": False},
    "SF":  {"name": "Levi's Stadium", "lat": 37.4033, "lon": -121.9694, "dome": False},
    "TB":  {"name": "Raymond James Stadium", "lat": 27.9759, "lon": -82.5033, "dome": False},
    "TEN": {"name": "Nissan Stadium", "lat": 36.1665, "lon": -86.7713, "dome": False},
    "WAS": {"name": "Northwest Stadium", "lat": 38.9076, "lon": -76.8645, "dome": False},
}

# Weather adjustment constants (applied to predicted total)
WIND_THRESHOLD_MPH = 15.0
WIND_ADJUSTMENT = -3.0
COLD_THRESHOLD_F = 32.0
COLD_ADJUSTMENT = -1.5
PRECIP_ADJUSTMENT = -1.0


def fetch_game_weather(home_team: str, game_time: str | datetime) -> dict[str, Any] | None:
    """
    Fetch weather forecast for a game using OpenWeatherMap.

    Args:
        home_team: Team abbreviation (e.g., "GB")
        game_time: ISO-format datetime string or datetime object

    Returns:
        Dict with wind_mph, temp_f, precipitation, is_dome, raw data, or None on failure.
    """
    api_key = os.getenv("WEATHER_API_KEY")
    if not api_key or api_key == "your_openweathermap_key":
        logger.warning("WEATHER_API_KEY not set; skipping weather fetch")
        return None

    stadium = STADIUMS.get(home_team)
    if not stadium:
        logger.warning(f"No stadium data for team: {home_team}")
        return None

    # Dome games don't need weather
    if stadium["dome"] is True:
        return {
            "is_dome": True,
            "wind_mph": 0,
            "temp_f": 72,
            "precipitation": False,
            "description": "Indoor stadium",
            "adjustments": {"wind": 0, "cold": 0, "precip": 0, "total": 0},
        }

    # Parse game_time to unix timestamp
    if isinstance(game_time, str):
        try:
            game_time = datetime.fromisoformat(game_time.replace("Z", "+00:00"))
        except ValueError:
            logger.error(f"Could not parse game_time: {game_time}")
            return None

    try:
        # Use 5-day/3-hour forecast (free tier)
        url = "https://api.openweathermap.org/data/2.5/forecast"
        params = {
            "lat": stadium["lat"],
            "lon": stadium["lon"],
            "appid": api_key,
            "units": "imperial",
        }
        resp = requests.get(url, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()

        # Find the forecast closest to game time
        game_ts = game_time.timestamp()
        closest = None
        min_diff = float("inf")

        for entry in data.get("list", []):
            diff = abs(entry["dt"] - game_ts)
            if diff < min_diff:
                min_diff = diff
                closest = entry

        if not closest:
            logger.warning(f"No forecast data found near game time for {home_team}")
            return None

        wind_mph = closest.get("wind", {}).get("speed", 0)
        temp_f = closest.get("main", {}).get("temp", 72)
        weather_main = closest.get("weather", [{}])[0].get("main", "").lower()
        has_precip = weather_main in ("rain", "snow", "drizzle", "thunderstorm", "sleet")
        description = closest.get("weather", [{}])[0].get("description", "")

        # Calculate adjustments
        wind_adj = WIND_ADJUSTMENT if wind_mph > WIND_THRESHOLD_MPH else 0
        cold_adj = COLD_ADJUSTMENT if temp_f < COLD_THRESHOLD_F else 0
        precip_adj = PRECIP_ADJUSTMENT if has_precip else 0

        # Retractable roofs: assume closed in bad weather (no adjustments)
        if stadium["dome"] == "retractable" and (has_precip or temp_f < 50):
            wind_adj = cold_adj = precip_adj = 0
            description = f"Retractable roof likely closed ({description})"

        total_adj = wind_adj + cold_adj + precip_adj

        result = {
            "is_dome": stadium["dome"] == "retractable",
            "wind_mph": round(wind_mph, 1),
            "temp_f": round(temp_f, 1),
            "precipitation": has_precip,
            "description": description,
            "adjustments": {
                "wind": wind_adj,
                "cold": cold_adj,
                "precip": precip_adj,
                "total": total_adj,
            },
        }

        logger.info(f"Weather for {home_team}: {temp_f}F, {wind_mph}mph wind, adj={total_adj}")
        return result

    except requests.RequestException as e:
        logger.error(f"Weather API request failed for {home_team}: {e}")
        return None
    except (KeyError, ValueError) as e:
        logger.error(f"Weather data parse error for {home_team}: {e}")
        return None


def get_weather_adjustment(weather: dict | None) -> float:
    """
    Extract the total points adjustment from a weather dict.
    Returns 0 if weather is None or has no adjustments.
    """
    if not weather:
        return 0.0
    return weather.get("adjustments", {}).get("total", 0.0)
