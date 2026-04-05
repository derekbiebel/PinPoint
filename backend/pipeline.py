"""
Pipeline orchestrator.

Fetches all data sources, computes ratings and edges, stores results.
Each step runs in try/except so individual failures don't kill the pipeline.
"""

import logging
from datetime import datetime

from backend.data import nfl_stats, espn_scraper, sleeper, weather, fanduel_odds
from backend.model import power_ratings, matchups as matchup_model, futures as futures_model, edge, player_rankings
from backend.db import store

logger = logging.getLogger(__name__)

# In-memory cache for player rankings (refreshed each pipeline run)
_player_rankings_cache: dict[str, list[dict]] = {}

def get_player_rankings() -> dict[str, list[dict]]:
    return _player_rankings_cache


def _current_nfl_season() -> int:
    """Determine the current NFL season year."""
    now = datetime.utcnow()
    # NFL season starts in September; if before March, it's last year's season
    if now.month <= 2:
        return now.year - 1
    return now.year


def _is_offseason() -> bool:
    """
    Determine if we're in the offseason.
    Offseason: March through August, and Feb after day 15.
    """
    now = datetime.utcnow()
    if 3 <= now.month <= 8:
        return True
    if now.month == 2 and now.day > 15:
        return True
    return False


async def run(include_odds: bool = False) -> dict:
    """
    Main pipeline execution.

    Steps:
        1. Determine mode (in-season vs offseason)
        2. Fetch data from all sources
        3. Compute power ratings
        4. Compute game predictions and edges
        5. Compute matchups
        6. Compute futures (offseason) or weekly edges (in-season)
        7. Store everything
        8. Log pipeline run

    Returns:
        Pipeline summary dict.
    """
    store.init_db()

    sources_fetched = []
    errors = []
    offseason = _is_offseason()
    season = _current_nfl_season()
    mode = "offseason" if offseason else "in-season"

    logger.info(f"Pipeline starting — mode: {mode}, season: {season}")

    # ---- Step 1: Get NFL state from Sleeper ----
    nfl_state = None
    try:
        nfl_state = sleeper.get_nfl_state()
        if nfl_state:
            sources_fetched.append("sleeper_state")
            season = int(nfl_state.get("season", season))
    except Exception as e:
        errors.append(f"sleeper_state: {e}")
        logger.error(f"Sleeper state fetch failed: {e}")

    current_week = nfl_state.get("week", 1) if nfl_state else 1

    # ---- Step 2: Fetch play-by-play data ----
    # In offseason, use last completed season's data since current season has none
    pbp = None
    team_epa = []
    pbp_seasons = [season]
    if offseason:
        pbp_seasons = [season - 1]
        logger.info(f"Offseason — using {season - 1} PBP data for ratings")

    try:
        pbp = nfl_stats.fetch_pbp(pbp_seasons)
        if pbp is not None and not pbp.empty:
            sources_fetched.append("nfl_pbp")
            # In offseason, use a high week number so all games are included
            epa_week = current_week if not offseason else 22
            team_epa = nfl_stats.compute_team_epa(pbp, epa_week)
    except Exception as e:
        errors.append(f"nfl_pbp: {e}")
        logger.error(f"PBP fetch failed: {e}")

    # ---- Step 3: Fetch injuries ----
    injuries = []
    try:
        injuries = espn_scraper.fetch_injuries()
        if injuries:
            sources_fetched.append("espn_injuries")
    except Exception as e:
        errors.append(f"espn_injuries: {e}")
        logger.error(f"ESPN injuries fetch failed: {e}")

    # ---- Step 4: Fetch rosters (ESPN) ----
    rosters = []
    try:
        roster_dict = espn_scraper.fetch_all_rosters()
        if roster_dict:
            sources_fetched.append("espn_rosters")
            # Flatten into single list
            for team_players in roster_dict.values():
                rosters.extend(team_players)
    except Exception as e:
        errors.append(f"espn_rosters: {e}")
        logger.error(f"ESPN rosters fetch failed: {e}")

    # ---- Step 4b: Fetch seasonal stats and compute player rankings ----
    player_ranks = {}
    try:
        seasonal = nfl_stats.fetch_seasonal_stats(pbp_seasons)
        if seasonal is not None and not seasonal.empty:
            sources_fetched.append("seasonal_stats")
            player_ranks = player_rankings.compute_player_rankings(seasonal)
            if player_ranks:
                global _player_rankings_cache
                _player_rankings_cache = player_ranks
                sources_fetched.append("player_rankings")
    except Exception as e:
        errors.append(f"player_rankings: {e}")
        logger.error(f"Player rankings failed: {e}")

    # ---- Step 5: Compute power ratings ----
    ratings = []
    try:
        if team_epa:
            ratings = power_ratings.compute_power_ratings(team_epa, injuries, rosters)
            if ratings:
                store.save_ratings(ratings)
                sources_fetched.append("power_ratings")
    except Exception as e:
        errors.append(f"power_ratings: {e}")
        logger.error(f"Power ratings computation failed: {e}")

    # ---- Step 6: Fetch FanDuel odds (only if requested) ----
    fd_games = []
    fd_futures_data = []
    if include_odds:
        try:
            fd_games = fanduel_odds.fetch_nfl_odds()
            if fd_games:
                sources_fetched.append("fanduel_odds")
        except Exception as e:
            errors.append(f"fanduel_odds: {e}")
            logger.error(f"FanDuel odds fetch failed: {e}")

        if offseason:
            try:
                fd_futures_data = fanduel_odds.fetch_nfl_futures()
                if fd_futures_data:
                    sources_fetched.append("fanduel_futures")
            except Exception as e:
                errors.append(f"fanduel_futures: {e}")
                logger.error(f"FanDuel futures fetch failed: {e}")
    else:
        logger.info("Skipping FanDuel odds (include_odds=False)")

    # ---- Step 7: Build ratings lookup for game predictions ----
    ratings_map = {r["team"]: r for r in ratings}
    games_to_store = []

    if not offseason and fd_games:
        for fd_game in fd_games:
            try:
                home_full = fd_game.get("home_team", "")
                away_full = fd_game.get("away_team", "")
                home_abbr = fanduel_odds.normalize_team_name(home_full)
                away_abbr = fanduel_odds.normalize_team_name(away_full)

                home_r = ratings_map.get(home_abbr)
                away_r = ratings_map.get(away_abbr)

                # Fetch weather
                weather_data = None
                try:
                    game_time = fd_game.get("commence_time")
                    if game_time and home_abbr:
                        weather_data = weather.fetch_game_weather(home_abbr, game_time)
                except Exception as we:
                    logger.warning(f"Weather fetch failed for {home_abbr}: {we}")

                weather_adj = weather.get_weather_adjustment(weather_data)

                # Predict game
                if home_r and away_r:
                    prediction = power_ratings.predict_game(
                        home_r, away_r, weather_adj=weather_adj
                    )
                    model_spread = prediction["model_spread"]
                    model_total = prediction["model_total"]
                else:
                    model_spread = None
                    model_total = None

                # Compute edges
                fd_spread = fd_game.get("fd_spread")
                fd_total = fd_game.get("fd_total")
                edges = edge.compute_game_edges(
                    model_spread or 0, model_total or 45,
                    fd_spread, fd_total,
                )

                games_to_store.append({
                    "id": fd_game.get("id", f"{home_abbr}_{away_abbr}_{season}_{current_week}"),
                    "season": season,
                    "week": current_week,
                    "home_team": home_abbr,
                    "away_team": away_abbr,
                    "commence_time": fd_game.get("commence_time"),
                    "model_spread": model_spread,
                    "model_total": model_total,
                    "fd_spread": fd_spread,
                    "fd_total": fd_total,
                    "spread_edge": edges.get("spread_edge"),
                    "total_edge": edges.get("total_edge"),
                    "edge_tier": edges.get("edge_tier"),
                    "weather_json": weather_data,
                })

            except Exception as e:
                errors.append(f"game_prediction_{fd_game.get('id', '?')}: {e}")
                logger.error(f"Game prediction failed: {e}")

        # Store games
        if games_to_store:
            try:
                store.save_games(games_to_store)
                sources_fetched.append("game_predictions")
            except Exception as e:
                errors.append(f"save_games: {e}")

    # ---- Step 8: Compute matchups (in-season) ----
    all_matchups = []
    if not offseason and pbp is not None and games_to_store:
        for game in games_to_store:
            try:
                game_matchups = matchup_model.compute_matchups_from_pbp(
                    pbp, game["home_team"], game["away_team"], game["id"]
                )
                all_matchups.extend(game_matchups)
            except Exception as e:
                errors.append(f"matchup_{game['id']}: {e}")

        if all_matchups:
            try:
                store.save_matchups(all_matchups)
                sources_fetched.append("matchups")
            except Exception as e:
                errors.append(f"save_matchups: {e}")

    # ---- Step 9: Compute futures (offseason mode) ----
    futures_results = []
    if offseason:
        try:
            schedule_data = None
            try:
                schedule_data = nfl_stats.fetch_schedule([season])
                if schedule_data is not None:
                    schedule_data = schedule_data.to_dict("records")
            except Exception:
                pass

            futures_results = futures_model.compute_futures(
                team_ratings=ratings,
                schedule=schedule_data,
                fd_futures=fd_futures_data,
            )
            if futures_results:
                store.save_futures(futures_results)
                sources_fetched.append("futures")
        except Exception as e:
            errors.append(f"futures: {e}")
            logger.error(f"Futures computation failed: {e}")

    # ---- Step 10: Log pipeline run ----
    requests_remaining = fanduel_odds.get_requests_remaining()
    status = "success" if not errors else "partial" if sources_fetched else "failed"

    try:
        store.log_pipeline_run(
            status=status,
            sources=sources_fetched,
            errors=errors,
            requests_remaining=requests_remaining,
        )
    except Exception as e:
        logger.error(f"Failed to log pipeline run: {e}")

    summary = {
        "status": status,
        "mode": mode,
        "season": season,
        "week": current_week,
        "sources_fetched": sources_fetched,
        "errors": errors,
        "teams_rated": len(ratings),
        "games_predicted": len(games_to_store),
        "matchups_computed": len(all_matchups),
        "futures_computed": len(futures_results),
        "requests_remaining": requests_remaining,
    }

    logger.info(f"Pipeline complete: {summary}")
    return summary
