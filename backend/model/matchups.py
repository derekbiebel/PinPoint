"""
Positional matchup analysis.

Evaluates OL vs DL, CB vs WR, and run game matchups
to produce per-game matchup scores and advantages.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _safe_mean(values: list[float], default: float = 0.0) -> float:
    """Compute mean of a list, returning default if empty."""
    return float(np.mean(values)) if values else default


def evaluate_pass_rush_matchup(
    home_ol_stats: dict,
    away_dl_stats: dict,
    away_ol_stats: dict,
    home_dl_stats: dict,
) -> dict:
    """
    OL vs DL pass rush matchup.

    Inputs are team-level stats dicts with keys like:
        - sack_rate: sacks allowed (OL) or generated (DL) per dropback
        - pressure_rate: pressures per dropback
        - pass_block_epa: EPA on pass-blocking snaps

    Returns matchup score for each side and advantage label.
    """
    # Home offense OL vs Away defense DL
    home_ol_score = (
        (1.0 - home_ol_stats.get("sack_rate", 0.05)) * 50
        + (1.0 - home_ol_stats.get("pressure_rate", 0.25)) * 30
        + home_ol_stats.get("pass_block_epa", 0.0) * 20
    )

    away_dl_score = (
        away_dl_stats.get("sack_rate", 0.05) * 50
        + away_dl_stats.get("pressure_rate", 0.25) * 30
        + away_dl_stats.get("pass_rush_epa", 0.0) * 20
    )

    # Away offense OL vs Home defense DL
    away_ol_score = (
        (1.0 - away_ol_stats.get("sack_rate", 0.05)) * 50
        + (1.0 - away_ol_stats.get("pressure_rate", 0.25)) * 30
        + away_ol_stats.get("pass_block_epa", 0.0) * 20
    )

    home_dl_score = (
        home_dl_stats.get("sack_rate", 0.05) * 50
        + home_dl_stats.get("pressure_rate", 0.25) * 30
        + home_dl_stats.get("pass_rush_epa", 0.0) * 20
    )

    # Net advantage: positive = home advantage
    home_net = home_ol_score - away_dl_score
    away_net = away_ol_score - home_dl_score

    if home_net > away_net + 5:
        advantage = "HOME"
    elif away_net > home_net + 5:
        advantage = "AWAY"
    else:
        advantage = "EVEN"

    return {
        "matchup_type": "pass_rush",
        "home_score": round(home_net, 1),
        "away_score": round(away_net, 1),
        "advantage": advantage,
        "notes": f"Home OL vs Away DL: {home_net:.1f} | Away OL vs Home DL: {away_net:.1f}",
    }


def evaluate_coverage_matchup(
    home_wr_stats: list[dict],
    away_cb_stats: list[dict],
    away_wr_stats: list[dict],
    home_cb_stats: list[dict],
) -> dict:
    """
    CB vs WR coverage matchup.

    WR stats: target_share, epa_per_target, air_yards_share
    CB stats: coverage_epa, targets_allowed_rate

    Returns matchup score and advantage.
    """
    # Home WR attack vs Away CB defense
    home_wr_score = sum(
        wr.get("epa_per_target", 0.0) * wr.get("target_share", 0.1) * 100
        for wr in home_wr_stats[:3]  # top 3 WRs
    )

    away_cb_score = sum(
        cb.get("coverage_epa", 0.0) * 100
        for cb in away_cb_stats[:3]
    )

    # Away WR attack vs Home CB defense
    away_wr_score = sum(
        wr.get("epa_per_target", 0.0) * wr.get("target_share", 0.1) * 100
        for wr in away_wr_stats[:3]
    )

    home_cb_score = sum(
        cb.get("coverage_epa", 0.0) * 100
        for cb in home_cb_stats[:3]
    )

    home_net = home_wr_score - away_cb_score
    away_net = away_wr_score - home_cb_score

    if home_net > away_net + 3:
        advantage = "HOME"
    elif away_net > home_net + 3:
        advantage = "AWAY"
    else:
        advantage = "EVEN"

    return {
        "matchup_type": "coverage",
        "home_score": round(home_net, 1),
        "away_score": round(away_net, 1),
        "advantage": advantage,
        "notes": f"Home WR vs Away CB: {home_net:.1f} | Away WR vs Home CB: {away_net:.1f}",
    }


def evaluate_run_game_matchup(
    home_run_stats: dict,
    away_run_def_stats: dict,
    away_run_stats: dict,
    home_run_def_stats: dict,
) -> dict:
    """
    Run game matchup.

    Run stats: rush_epa, yards_per_carry, success_rate
    Run def stats: rush_epa_allowed, yards_per_carry_allowed, stuff_rate
    """
    home_run_score = (
        home_run_stats.get("rush_epa", 0.0) * 40
        + home_run_stats.get("yards_per_carry", 4.0) * 8
        + home_run_stats.get("success_rate", 0.4) * 30
    )

    away_run_def_score = (
        away_run_def_stats.get("rush_epa_allowed", 0.0) * 40
        + (1.0 / max(away_run_def_stats.get("yards_per_carry_allowed", 4.0), 0.1)) * 30
        + away_run_def_stats.get("stuff_rate", 0.15) * 20
    )

    away_run_score = (
        away_run_stats.get("rush_epa", 0.0) * 40
        + away_run_stats.get("yards_per_carry", 4.0) * 8
        + away_run_stats.get("success_rate", 0.4) * 30
    )

    home_run_def_score = (
        home_run_def_stats.get("rush_epa_allowed", 0.0) * 40
        + (1.0 / max(home_run_def_stats.get("yards_per_carry_allowed", 4.0), 0.1)) * 30
        + home_run_def_stats.get("stuff_rate", 0.15) * 20
    )

    home_net = home_run_score - away_run_def_score
    away_net = away_run_score - home_run_def_score

    if home_net > away_net + 3:
        advantage = "HOME"
    elif away_net > home_net + 3:
        advantage = "AWAY"
    else:
        advantage = "EVEN"

    return {
        "matchup_type": "run_game",
        "home_score": round(home_net, 1),
        "away_score": round(away_net, 1),
        "advantage": advantage,
        "notes": f"Home run game: {home_net:.1f} | Away run game: {away_net:.1f}",
    }


def compute_matchups_from_pbp(pbp: pd.DataFrame, home_team: str, away_team: str,
                               game_id: str) -> list[dict]:
    """
    Compute all matchup types for a game using play-by-play data.
    This is a simplified version that derives matchup proxies from PBP EPA.

    Returns a list of matchup dicts ready for storage.
    """
    if pbp is None or pbp.empty:
        return []

    plays = pbp.dropna(subset=["epa"]).copy()
    results = []

    # --- Pass Rush Proxy: sack/pressure via EPA on dropbacks ---
    def _pass_stats(team: str, side: str) -> dict:
        if side == "offense":
            team_plays = plays[(plays["posteam"] == team) & (plays["play_type"] == "pass")]
        else:
            team_plays = plays[(plays["defteam"] == team) & (plays["play_type"] == "pass")]

        if team_plays.empty:
            return {"sack_rate": 0.05, "pressure_rate": 0.25, "pass_block_epa": 0.0,
                    "pass_rush_epa": 0.0}

        sack_rate = float(team_plays["sack"].mean()) if "sack" in team_plays.columns else 0.05
        epa_mean = float(team_plays["epa"].mean())

        return {
            "sack_rate": sack_rate,
            "pressure_rate": sack_rate * 3,  # rough proxy
            "pass_block_epa": epa_mean if side == "offense" else 0.0,
            "pass_rush_epa": -epa_mean if side == "defense" else 0.0,
        }

    pr = evaluate_pass_rush_matchup(
        home_ol_stats=_pass_stats(home_team, "offense"),
        away_dl_stats=_pass_stats(away_team, "defense"),
        away_ol_stats=_pass_stats(away_team, "offense"),
        home_dl_stats=_pass_stats(home_team, "defense"),
    )
    pr["game_id"] = game_id
    results.append(pr)

    # --- Run Game Proxy ---
    def _run_stats(team: str, side: str) -> dict:
        if side == "offense":
            team_plays = plays[(plays["posteam"] == team) & (plays["play_type"] == "run")]
        else:
            team_plays = plays[(plays["defteam"] == team) & (plays["play_type"] == "run")]

        if team_plays.empty:
            return {"rush_epa": 0.0, "yards_per_carry": 4.0, "success_rate": 0.4,
                    "rush_epa_allowed": 0.0, "yards_per_carry_allowed": 4.0, "stuff_rate": 0.15}

        epa_mean = float(team_plays["epa"].mean())
        ypc = float(team_plays["yards_gained"].mean()) if "yards_gained" in team_plays.columns else 4.0
        success = float((team_plays["epa"] > 0).mean())

        if side == "offense":
            return {"rush_epa": epa_mean, "yards_per_carry": ypc, "success_rate": success}
        else:
            return {"rush_epa_allowed": epa_mean, "yards_per_carry_allowed": ypc,
                    "stuff_rate": 1.0 - success}

    rg = evaluate_run_game_matchup(
        home_run_stats=_run_stats(home_team, "offense"),
        away_run_def_stats=_run_stats(away_team, "defense"),
        away_run_stats=_run_stats(away_team, "offense"),
        home_run_def_stats=_run_stats(home_team, "defense"),
    )
    rg["game_id"] = game_id
    results.append(rg)

    # --- Coverage Proxy (simplified — uses pass EPA as stand-in) ---
    def _wr_proxy(team: str) -> list[dict]:
        """Use team pass EPA as a WR effectiveness proxy."""
        team_passes = plays[(plays["posteam"] == team) & (plays["play_type"] == "pass")]
        if team_passes.empty:
            return [{"epa_per_target": 0.0, "target_share": 0.33}]
        return [{"epa_per_target": float(team_passes["epa"].mean()), "target_share": 0.33}]

    def _cb_proxy(team: str) -> list[dict]:
        """Use team pass defense EPA as a CB effectiveness proxy."""
        team_passes = plays[(plays["defteam"] == team) & (plays["play_type"] == "pass")]
        if team_passes.empty:
            return [{"coverage_epa": 0.0}]
        return [{"coverage_epa": float(team_passes["epa"].mean())}]

    cov = evaluate_coverage_matchup(
        home_wr_stats=_wr_proxy(home_team),
        away_cb_stats=_cb_proxy(away_team),
        away_wr_stats=_wr_proxy(away_team),
        home_cb_stats=_cb_proxy(home_team),
    )
    cov["game_id"] = game_id
    results.append(cov)

    return results
