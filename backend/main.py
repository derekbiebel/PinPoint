"""
Pinpoint NFL Power Rankings — FastAPI Application.

Endpoints:
    POST /api/refresh       — trigger the data pipeline
    GET  /api/games         — games with edges
    GET  /api/futures       — futures analysis
    GET  /api/teams         — all 32 team ratings
    GET  /api/team/{abbrev} — single team detail
    GET  /api/matchups      — positional matchup scores
    GET  /api/status        — last refresh time and API requests remaining
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Load .env before anything else reads env vars
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from backend.db import store
from backend.pipeline import run as run_pipeline
from backend.data.fanduel_odds import get_requests_remaining

# ---------- Logging ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------- Mode Detection ----------

def detect_mode() -> str:
    """
    Auto-detect offseason vs in-season.
    Offseason: March through August, and February after day 15.
    In-season: September through mid-February.
    """
    now = datetime.utcnow()
    if 3 <= now.month <= 8:
        return "offseason"
    if now.month == 2 and now.day > 15:
        return "offseason"
    return "in-season"


# ---------- Lifespan ----------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    store.init_db()
    logger.info(f"Pinpoint started — mode: {detect_mode()}")
    yield
    logger.info("Pinpoint shutting down")


# ---------- App ----------

app = FastAPI(
    title="Pinpoint NFL Power Rankings",
    description="EPA-based NFL power ratings with edge detection against FanDuel lines.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for simplicity (this is a personal tool, not a public API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Endpoints ----------

@app.post("/api/refresh")
async def refresh():
    """
    Trigger the full data pipeline.
    Fetches data, computes ratings, computes edges, stores everything.
    """
    try:
        summary = await run_pipeline()
        return {"ok": True, "summary": summary}
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


@app.get("/api/games")
async def get_games(
    season: int | None = Query(None, description="Filter by season year"),
    week: int | None = Query(None, description="Filter by week number"),
):
    """Get all games with model predictions and FanDuel edge analysis."""
    try:
        games = store.get_games(season=season, week=week)
        mode = detect_mode()
        return {"mode": mode, "count": len(games), "games": games}
    except Exception as e:
        logger.error(f"Error fetching games: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/futures")
async def get_futures(
    season: int | None = Query(None, description="Filter by season year"),
):
    """Get futures projections with FanDuel win total comparisons."""
    try:
        futures = store.get_futures(season=season)
        mode = detect_mode()
        return {"mode": mode, "count": len(futures), "futures": futures}
    except Exception as e:
        logger.error(f"Error fetching futures: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/teams")
async def get_teams(
    season: int | None = Query(None, description="Filter by season year"),
    week: int | None = Query(None, description="Filter by week number"),
):
    """Get power ratings for all 32 teams, sorted by composite rating."""
    try:
        ratings = store.get_ratings(season=season, week=week)
        mode = detect_mode()
        return {"mode": mode, "count": len(ratings), "teams": ratings}
    except Exception as e:
        logger.error(f"Error fetching teams: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/team/{abbrev}")
async def get_team(abbrev: str):
    """
    Get detailed info for a single team.
    Returns the latest rating, recent games, and matchup data.
    """
    team = abbrev.upper()
    try:
        rating = store.get_team_rating(team)
        if not rating:
            raise HTTPException(status_code=404, detail=f"Team {team} not found")

        # Get games involving this team
        all_games = store.get_games()
        team_games = [
            g for g in all_games
            if g.get("home_team") == team or g.get("away_team") == team
        ]

        # Get matchups for this team's games
        team_matchups = []
        for g in team_games:
            m = store.get_matchups(game_id=g.get("id"))
            if m:
                team_matchups.extend(m)

        mode = detect_mode()
        return {
            "mode": mode,
            "team": team,
            "rating": rating,
            "games": team_games,
            "matchups": team_matchups,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching team {team}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/matchups")
async def get_matchups(
    game_id: str | None = Query(None, description="Filter by game ID"),
):
    """Get positional matchup scores for all games or a specific game."""
    try:
        matchups = store.get_matchups(game_id=game_id)
        return {"count": len(matchups), "matchups": matchups}
    except Exception as e:
        logger.error(f"Error fetching matchups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/status")
async def get_status():
    """
    Get system status: last refresh time, API requests remaining, current mode.
    """
    try:
        last_run = store.get_last_pipeline_run()
        mode = detect_mode()

        return {
            "mode": mode,
            "last_refresh": last_run.get("run_at") if last_run else None,
            "last_status": last_run.get("status") if last_run else None,
            "sources_fetched": last_run.get("sources_fetched") if last_run else [],
            "errors": last_run.get("errors") if last_run else [],
            "requests_remaining": last_run.get("requests_remaining") if last_run else None,
            "current_requests_remaining": get_requests_remaining(),
        }
    except Exception as e:
        logger.error(f"Error fetching status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Run with uvicorn ----------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
