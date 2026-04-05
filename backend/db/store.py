"""
SQLite read/write helpers for Pinpoint.
All functions operate on a single DB file stored next to this module.
"""

import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

DB_PATH = os.getenv("PINPOINT_DB", str(Path(__file__).parent / "pinpoint.db"))
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _get_conn() -> sqlite3.Connection:
    """Return a connection with row-factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables from schema.sql if they don't exist."""
    conn = _get_conn()
    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())
    conn.close()


# ---------- Team Ratings ----------

def save_ratings(ratings: list[dict]) -> None:
    """Upsert a batch of team ratings."""
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    for r in ratings:
        conn.execute(
            """INSERT INTO team_ratings (team, season, week, off_epa, def_epa, composite_rating, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(team, season, week) DO UPDATE SET
                 off_epa=excluded.off_epa,
                 def_epa=excluded.def_epa,
                 composite_rating=excluded.composite_rating,
                 updated_at=excluded.updated_at""",
            (r["team"], r["season"], r["week"], r["off_epa"], r["def_epa"],
             r["composite_rating"], now),
        )
    conn.commit()
    conn.close()


def get_ratings(season: int | None = None, week: int | None = None) -> list[dict]:
    """Retrieve team ratings, optionally filtered by season/week."""
    conn = _get_conn()
    query = "SELECT * FROM team_ratings WHERE 1=1"
    params: list[Any] = []
    if season is not None:
        query += " AND season = ?"
        params.append(season)
    if week is not None:
        query += " AND week = ?"
        params.append(week)
    query += " ORDER BY composite_rating DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_team_rating(team: str, season: int | None = None) -> dict | None:
    """Get the most recent rating for a single team."""
    conn = _get_conn()
    query = "SELECT * FROM team_ratings WHERE team = ?"
    params: list[Any] = [team]
    if season is not None:
        query += " AND season = ?"
        params.append(season)
    query += " ORDER BY week DESC LIMIT 1"
    row = conn.execute(query, params).fetchone()
    conn.close()
    return dict(row) if row else None


# ---------- Games ----------

def save_games(games: list[dict]) -> None:
    """Upsert a batch of games."""
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    for g in games:
        weather = json.dumps(g.get("weather_json")) if isinstance(g.get("weather_json"), dict) else g.get("weather_json")
        conn.execute(
            """INSERT INTO games (id, season, week, home_team, away_team, commence_time,
                model_spread, model_total, fd_spread, fd_total, spread_edge, total_edge,
                edge_tier, weather_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 model_spread=excluded.model_spread, model_total=excluded.model_total,
                 fd_spread=excluded.fd_spread, fd_total=excluded.fd_total,
                 spread_edge=excluded.spread_edge, total_edge=excluded.total_edge,
                 edge_tier=excluded.edge_tier, weather_json=excluded.weather_json,
                 updated_at=excluded.updated_at""",
            (g["id"], g["season"], g["week"], g["home_team"], g["away_team"],
             g.get("commence_time"), g.get("model_spread"), g.get("model_total"),
             g.get("fd_spread"), g.get("fd_total"), g.get("spread_edge"),
             g.get("total_edge"), g.get("edge_tier"), weather, now),
        )
    conn.commit()
    conn.close()


def get_games(season: int | None = None, week: int | None = None) -> list[dict]:
    """Retrieve games, optionally filtered."""
    conn = _get_conn()
    query = "SELECT * FROM games WHERE 1=1"
    params: list[Any] = []
    if season is not None:
        query += " AND season = ?"
        params.append(season)
    if week is not None:
        query += " AND week = ?"
        params.append(week)
    query += " ORDER BY commence_time"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        if d.get("weather_json"):
            try:
                d["weather_json"] = json.loads(d["weather_json"])
            except (json.JSONDecodeError, TypeError):
                pass
        results.append(d)
    return results


# ---------- Futures ----------

def save_futures(futures: list[dict]) -> None:
    """Upsert futures projections."""
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    for f in futures:
        conn.execute(
            """INSERT INTO futures (team, season, projected_wins, fd_win_total, edge, edge_direction, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(team, season) DO UPDATE SET
                 projected_wins=excluded.projected_wins, fd_win_total=excluded.fd_win_total,
                 edge=excluded.edge, edge_direction=excluded.edge_direction,
                 updated_at=excluded.updated_at""",
            (f["team"], f["season"], f.get("projected_wins"), f.get("fd_win_total"),
             f.get("edge"), f.get("edge_direction"), now),
        )
    conn.commit()
    conn.close()


def get_futures(season: int | None = None) -> list[dict]:
    """Retrieve futures projections."""
    conn = _get_conn()
    query = "SELECT * FROM futures"
    params: list[Any] = []
    if season is not None:
        query += " WHERE season = ?"
        params.append(season)
    query += " ORDER BY projected_wins DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------- Matchups ----------

def save_matchups(matchups: list[dict]) -> None:
    """Upsert positional matchup scores."""
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    for m in matchups:
        conn.execute(
            """INSERT INTO matchups (game_id, matchup_type, home_score, away_score, advantage, notes, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(game_id, matchup_type) DO UPDATE SET
                 home_score=excluded.home_score, away_score=excluded.away_score,
                 advantage=excluded.advantage, notes=excluded.notes,
                 updated_at=excluded.updated_at""",
            (m["game_id"], m["matchup_type"], m.get("home_score"), m.get("away_score"),
             m.get("advantage"), m.get("notes"), now),
        )
    conn.commit()
    conn.close()


def get_matchups(game_id: str | None = None) -> list[dict]:
    """Retrieve matchup data, optionally for a specific game."""
    conn = _get_conn()
    if game_id:
        rows = conn.execute("SELECT * FROM matchups WHERE game_id = ?", (game_id,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM matchups ORDER BY game_id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------- Pipeline Log ----------

def log_pipeline_run(status: str, sources: list[str], errors: list[str],
                     requests_remaining: int | None = None) -> None:
    """Record a pipeline execution."""
    conn = _get_conn()
    conn.execute(
        """INSERT INTO pipeline_log (status, sources_fetched, errors, requests_remaining)
           VALUES (?, ?, ?, ?)""",
        (status, json.dumps(sources), json.dumps(errors), requests_remaining),
    )
    conn.commit()
    conn.close()


def get_last_pipeline_run() -> dict | None:
    """Get the most recent pipeline run info."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM pipeline_log ORDER BY run_at DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    for key in ("sources_fetched", "errors"):
        if d.get(key):
            try:
                d[key] = json.loads(d[key])
            except (json.JSONDecodeError, TypeError):
                pass
    return d
