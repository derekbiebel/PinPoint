"""
Player rankings derived from nfl_data_py seasonal and weekly stats.

Ranks players by position group using the stats that matter most:
  - QB: EPA/play, CPOE, passing yards, TDs, passer rating
  - WR: receiving yards, targets, receptions, TDs, yards/reception
  - RB: rushing yards, TDs, yards/carry, receptions
  - TE: receiving yards, targets, receptions, TDs
  - DEF: sacks, interceptions, fumbles forced (from seasonal team data)
"""

import logging
import pandas as pd

logger = logging.getLogger(__name__)

POSITION_GROUPS = {
    "QB": {
        "sort_by": "passing_epa",
        "columns": [
            "player_name", "recent_team", "season",
            "passing_epa", "completions", "attempts", "passing_yards",
            "passing_tds", "interceptions", "carries", "rushing_yards",
            "rushing_tds", "dakota",
        ],
        "rename": {
            "passing_epa": "epa",
            "recent_team": "team",
            "passing_yards": "pass_yds",
            "passing_tds": "pass_td",
            "interceptions": "int",
            "rushing_yards": "rush_yds",
            "rushing_tds": "rush_td",
        },
    },
    "WR": {
        "sort_by": "receiving_yards",
        "columns": [
            "player_name", "recent_team", "season",
            "targets", "receptions", "receiving_yards", "receiving_tds",
            "receiving_epa", "target_share", "receiving_air_yards",
        ],
        "rename": {
            "recent_team": "team",
            "receiving_yards": "rec_yds",
            "receiving_tds": "rec_td",
            "receiving_epa": "epa",
            "receiving_air_yards": "air_yds",
        },
    },
    "RB": {
        "sort_by": "rushing_yards",
        "columns": [
            "player_name", "recent_team", "season",
            "carries", "rushing_yards", "rushing_tds", "rushing_epa",
            "receptions", "receiving_yards", "receiving_tds",
        ],
        "rename": {
            "recent_team": "team",
            "rushing_yards": "rush_yds",
            "rushing_tds": "rush_td",
            "rushing_epa": "epa",
            "receiving_yards": "rec_yds",
            "receiving_tds": "rec_td",
        },
    },
    "TE": {
        "sort_by": "receiving_yards",
        "columns": [
            "player_name", "recent_team", "season",
            "targets", "receptions", "receiving_yards", "receiving_tds",
            "receiving_epa", "target_share",
        ],
        "rename": {
            "recent_team": "team",
            "receiving_yards": "rec_yds",
            "receiving_tds": "rec_td",
            "receiving_epa": "epa",
        },
    },
}


def compute_player_rankings(seasonal_stats: pd.DataFrame) -> dict[str, list[dict]]:
    """
    Compute player rankings by position group from seasonal stats.

    Returns:
        {"QB": [...], "WR": [...], "RB": [...], "TE": [...]}
    """
    if seasonal_stats is None or seasonal_stats.empty:
        return {}

    results = {}

    for pos, config in POSITION_GROUPS.items():
        try:
            # Filter to position
            pos_df = seasonal_stats[seasonal_stats["position"] == pos].copy()

            if pos_df.empty:
                results[pos] = []
                continue

            # Select available columns
            available_cols = [c for c in config["columns"] if c in pos_df.columns]
            pos_df = pos_df[available_cols].copy()

            # Drop rows where the sort column is missing
            sort_col = config["sort_by"]
            if sort_col in pos_df.columns:
                pos_df = pos_df.dropna(subset=[sort_col])
                pos_df = pos_df.sort_values(sort_col, ascending=False)

            # Rename columns for cleaner output
            pos_df = pos_df.rename(columns={
                k: v for k, v in config["rename"].items() if k in pos_df.columns
            })

            # Add rank
            pos_df = pos_df.reset_index(drop=True)
            pos_df["rank"] = pos_df.index + 1

            # Round numeric columns
            for col in pos_df.select_dtypes(include=["float64", "float32"]).columns:
                pos_df[col] = pos_df[col].round(2)

            # Convert to list of dicts
            results[pos] = pos_df.head(50).to_dict("records")
            logger.info(f"Ranked {len(results[pos])} {pos}s")

        except Exception as e:
            logger.error(f"Failed to rank {pos}: {e}")
            results[pos] = []

    return results
