"""
Offseason futures model.

Projects season win totals using roster construction, draft capital,
coaching changes, and strength of schedule. Compares to FanDuel lines.
"""

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# ---------- Constants ----------

# Roster construction weights
QB_CAREER_EPA_WEIGHT = 3.0
WR_AIR_YARDS_WEIGHT = 0.5
OL_SACK_RATE_WEIGHT = -15.0  # negative because lower sack rate = better
RETURNING_STARTER_WEIGHT = 0.3  # per percentage point of returning snap %

# Draft capital adjustments (wins added)
DRAFT_ADJUSTMENTS = {
    "R1_QB": 1.5,
    "R1_SKILL": 0.8,  # WR, RB, TE
    "R1_OL": 0.5,
    "R1_DEF": 0.4,
    "R2_QB": 0.5,
    "R2_OTHER": 0.2,
}

# Coaching change regression
NEW_HC_OC_REGRESSION = 0.30  # regress offense 30%
NEW_DC_REGRESSION = 0.20     # regress defense 20%

# Simulation parameters
NUM_SIMULATIONS = 10_000
GAME_STDEV = 13.5  # typical NFL game standard deviation in points


# ---------- All 32 NFL Teams ----------
ALL_TEAMS = [
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
    "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
    "LAC", "LAR", "LV", "MIA", "MIN", "NE", "NO", "NYG",
    "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
]


def compute_roster_score(
    qb_career_epa: float = 0.0,
    wr_air_yards: float = 0.0,
    ol_sack_rate: float = 0.06,
    returning_snap_pct: float = 60.0,
) -> float:
    """
    Score a roster's construction quality.
    Higher = better roster on paper.

    Args:
        qb_career_epa: Starting QB's career EPA per play
        wr_air_yards: Total air yards of top-3 WRs (per game)
        ol_sack_rate: Offensive line sack rate (lower = better)
        returning_snap_pct: % of prior-year starter snaps returning
    """
    score = (
        qb_career_epa * QB_CAREER_EPA_WEIGHT
        + wr_air_yards * WR_AIR_YARDS_WEIGHT
        + ol_sack_rate * OL_SACK_RATE_WEIGHT
        + returning_snap_pct * RETURNING_STARTER_WEIGHT
    )
    return round(score, 2)


def apply_draft_capital(base_wins: float, draft_picks: list[dict]) -> float:
    """
    Adjust projected wins based on draft capital.

    draft_picks: list of {round: int, position: str}
    """
    adjustment = 0.0
    for pick in draft_picks:
        rd = pick.get("round", 7)
        pos = pick.get("position", "").upper()

        if rd == 1:
            if pos == "QB":
                adjustment += DRAFT_ADJUSTMENTS["R1_QB"]
            elif pos in ("WR", "RB", "TE"):
                adjustment += DRAFT_ADJUSTMENTS["R1_SKILL"]
            elif pos in ("OT", "OG", "C", "OL"):
                adjustment += DRAFT_ADJUSTMENTS["R1_OL"]
            else:
                adjustment += DRAFT_ADJUSTMENTS["R1_DEF"]
        elif rd == 2:
            if pos == "QB":
                adjustment += DRAFT_ADJUSTMENTS["R2_QB"]
            else:
                adjustment += DRAFT_ADJUSTMENTS["R2_OTHER"]

    return base_wins + adjustment


def apply_coaching_regression(
    off_rating: float,
    def_rating: float,
    new_hc_or_oc: bool = False,
    new_dc: bool = False,
) -> tuple[float, float]:
    """
    Regress ratings toward league average for coaching changes.

    Returns (adjusted_off, adjusted_def).
    """
    league_avg = 0.0  # EPA ratings center around 0

    adj_off = off_rating
    adj_def = def_rating

    if new_hc_or_oc:
        adj_off = off_rating * (1 - NEW_HC_OC_REGRESSION) + league_avg * NEW_HC_OC_REGRESSION
        logger.info(f"HC/OC change: offense regressed {off_rating:.3f} -> {adj_off:.3f}")

    if new_dc:
        adj_def = def_rating * (1 - NEW_DC_REGRESSION) + league_avg * NEW_DC_REGRESSION
        logger.info(f"DC change: defense regressed {def_rating:.3f} -> {adj_def:.3f}")

    return adj_off, adj_def


def compute_strength_of_schedule(
    team: str,
    schedule: list[dict],
    team_ratings: dict[str, float],
) -> float:
    """
    Compute average opponent rating for a team's schedule.

    Args:
        team: Team abbreviation
        schedule: List of game dicts with home_team and away_team
        team_ratings: Dict of {team: composite_rating}

    Returns:
        Average opponent composite rating (0 = league average).
    """
    opponent_ratings = []
    for game in schedule:
        if game.get("home_team") == team:
            opp = game.get("away_team")
        elif game.get("away_team") == team:
            opp = game.get("home_team")
        else:
            continue

        if opp and opp in team_ratings:
            opponent_ratings.append(team_ratings[opp])

    if not opponent_ratings:
        return 0.0

    return float(np.mean(opponent_ratings))


def simulate_season(
    team_rating: float,
    opponent_ratings: list[float],
    home_flags: list[bool],
    n_sims: int = NUM_SIMULATIONS,
) -> dict:
    """
    Monte Carlo season simulation.

    For each game, compute win probability from rating difference,
    then simulate the outcome n_sims times.

    Args:
        team_rating: This team's composite rating
        opponent_ratings: List of opponent ratings (one per game)
        home_flags: Whether team is home for each game
        n_sims: Number of simulation iterations

    Returns:
        {projected_wins, win_distribution, percentiles}
    """
    n_games = len(opponent_ratings)
    if n_games == 0:
        return {"projected_wins": 0.0, "win_distribution": {}, "percentiles": {}}

    rng = np.random.default_rng()
    win_totals = np.zeros(n_sims)

    for game_idx in range(n_games):
        # Rating difference (home team perspective)
        diff = team_rating - opponent_ratings[game_idx]
        if home_flags[game_idx]:
            diff += 2.5  # home-field advantage

        # Win probability from point spread (using logistic approximation)
        # P(win) = 1 / (1 + 10^(-diff/7))
        win_prob = 1.0 / (1.0 + 10.0 ** (-diff / 7.0))
        win_prob = max(0.01, min(0.99, win_prob))

        # Simulate
        outcomes = rng.random(n_sims) < win_prob
        win_totals += outcomes

    projected_wins = float(np.mean(win_totals))

    # Win distribution
    unique, counts = np.unique(win_totals, return_counts=True)
    distribution = {int(w): int(c) for w, c in zip(unique, counts)}

    # Percentiles
    percentiles = {
        "p10": float(np.percentile(win_totals, 10)),
        "p25": float(np.percentile(win_totals, 25)),
        "p50": float(np.percentile(win_totals, 50)),
        "p75": float(np.percentile(win_totals, 75)),
        "p90": float(np.percentile(win_totals, 90)),
    }

    return {
        "projected_wins": round(projected_wins, 1),
        "win_distribution": distribution,
        "percentiles": percentiles,
    }


def compute_futures(
    team_ratings: list[dict],
    schedule: list[dict] | None = None,
    fd_futures: list[dict] | None = None,
    coaching_changes: dict[str, dict] | None = None,
    draft_picks: dict[str, list[dict]] | None = None,
) -> list[dict]:
    """
    Full futures pipeline: adjust ratings, simulate seasons, compare to FanDuel.

    Args:
        team_ratings: List of team rating dicts
        schedule: Season schedule (list of game dicts)
        fd_futures: FanDuel win total lines [{team, fd_win_total}]
        coaching_changes: {team: {new_hc_oc: bool, new_dc: bool}}
        draft_picks: {team: [{round, position}]}

    Returns:
        List of futures dicts ready for storage.
    """
    if not team_ratings:
        logger.warning("No team ratings for futures computation")
        return []

    # Build ratings lookup
    ratings_map = {}
    for r in team_ratings:
        ratings_map[r["team"]] = r.get("composite_rating", 0.0)

    # Build FanDuel lookup
    fd_map = {}
    if fd_futures:
        from backend.data.fanduel_odds import normalize_team_name
        for f in fd_futures:
            team_abbr = normalize_team_name(f.get("team", ""))
            if f.get("fd_win_total") is not None:
                fd_map[team_abbr] = f["fd_win_total"]

    season = team_ratings[0].get("season", 2025) if team_ratings else 2025
    results = []

    for team in ALL_TEAMS:
        rating = ratings_map.get(team, 0.0)

        # Apply coaching regression if applicable
        if coaching_changes and team in coaching_changes:
            cc = coaching_changes[team]
            # Simplified: adjust composite rating directly
            if cc.get("new_hc_oc"):
                rating *= (1 - NEW_HC_OC_REGRESSION)
            if cc.get("new_dc"):
                rating *= (1 - NEW_DC_REGRESSION * 0.5)  # defense is half the equation

        # Apply draft capital if available
        # Convert composite rating to win baseline
        # Ratings range roughly -100 to +120. Map to ~3-14 wins.
        # 8.5 is league average, scale by a factor that keeps wins realistic
        base_wins = 8.5 + (rating / 40.0)  # ~+3 wins for top team, ~-2.5 for worst
        if draft_picks and team in draft_picks:
            base_wins = apply_draft_capital(base_wins, draft_picks[team])

        # Build opponent list from schedule
        opp_ratings = []
        home_flags = []
        if schedule:
            for game in schedule:
                if game.get("home_team") == team:
                    opp = game.get("away_team", "")
                    opp_ratings.append(ratings_map.get(opp, 0.0))
                    home_flags.append(True)
                elif game.get("away_team") == team:
                    opp = game.get("home_team", "")
                    opp_ratings.append(ratings_map.get(opp, 0.0))
                    home_flags.append(False)

        # If no schedule, create a generic 17-game season
        if not opp_ratings:
            opp_ratings = [0.0] * 17  # league-average opponents
            home_flags = [True] * 9 + [False] * 8

        # Run simulation
        sim = simulate_season(rating, opp_ratings, home_flags)
        projected = sim["projected_wins"]

        # Compare to FanDuel
        fd_total = fd_map.get(team)
        edge = None
        edge_direction = None
        if fd_total is not None:
            edge = round(projected - fd_total, 1)
            if edge > 0.5:
                edge_direction = "OVER"
            elif edge < -0.5:
                edge_direction = "UNDER"
            else:
                edge_direction = "NONE"

        results.append({
            "team": team,
            "season": season,
            "projected_wins": projected,
            "fd_win_total": fd_total,
            "edge": edge,
            "edge_direction": edge_direction,
        })

    results.sort(key=lambda x: x["projected_wins"], reverse=True)
    logger.info(f"Computed futures for {len(results)} teams")
    return results
