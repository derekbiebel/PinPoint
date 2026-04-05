-- Pinpoint NFL Power Rankings — SQLite Schema

CREATE TABLE IF NOT EXISTS team_ratings (
    team        TEXT NOT NULL,
    season      INTEGER NOT NULL,
    week        INTEGER NOT NULL,
    off_epa     REAL,
    def_epa     REAL,
    composite_rating REAL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team, season, week)
);

CREATE TABLE IF NOT EXISTS games (
    id              TEXT PRIMARY KEY,
    season          INTEGER NOT NULL,
    week            INTEGER NOT NULL,
    home_team       TEXT NOT NULL,
    away_team       TEXT NOT NULL,
    commence_time   TEXT,
    model_spread    REAL,
    model_total     REAL,
    fd_spread       REAL,
    fd_total        REAL,
    spread_edge     REAL,
    total_edge      REAL,
    edge_tier       TEXT,
    weather_json    TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS futures (
    team            TEXT NOT NULL,
    season          INTEGER NOT NULL,
    projected_wins  REAL,
    fd_win_total    REAL,
    edge            REAL,
    edge_direction  TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team, season)
);

CREATE TABLE IF NOT EXISTS matchups (
    game_id         TEXT NOT NULL,
    matchup_type    TEXT NOT NULL,
    home_score      REAL,
    away_score      REAL,
    advantage       TEXT,
    notes           TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (game_id, matchup_type),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS pipeline_log (
    run_at              TEXT NOT NULL DEFAULT (datetime('now')),
    status              TEXT NOT NULL,
    sources_fetched     TEXT,
    errors              TEXT,
    requests_remaining  INTEGER
);
