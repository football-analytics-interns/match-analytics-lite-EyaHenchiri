-- database/init.sql
-- Schéma minimal + seed Match/Players/Events
-- NB: on garde 'match' comme nom de table (OK en PostgreSQL).
--     Si tu veux être ultra safe : CREATE TABLE IF NOT EXISTS "match" (...).

CREATE TABLE IF NOT EXISTS match (
                                     id          BIGINT PRIMARY KEY,
                                     date        TIMESTAMP WITH TIME ZONE NOT NULL,
                                     home_team   VARCHAR(255) NOT NULL,
    away_team   VARCHAR(255) NOT NULL,
    home_score  INT NOT NULL,
    away_score  INT NOT NULL
    );

CREATE TABLE IF NOT EXISTS player (
                                      id           BIGINT PRIMARY KEY,
                                      name         VARCHAR(255) NOT NULL,
    team         VARCHAR(255) NOT NULL,
    position     VARCHAR(50),
    -- Stats persistées pour aller plus vite côté UI
    goals        INT NOT NULL DEFAULT 0,
    assists      INT NOT NULL DEFAULT 0,
    form_rating  DOUBLE PRECISION NOT NULL DEFAULT 0.0
    );

CREATE TABLE IF NOT EXISTS event (
                                     id         BIGSERIAL PRIMARY KEY,  -- Auto
                                     minute     INT NOT NULL,
                                     type       VARCHAR(50) NOT NULL,   -- GOAL, SHOT, TACKLE, ...
    player_id  BIGINT REFERENCES player(id),
    meta       JSONB                    -- ex: {"assistId": 2, "onTarget": true}
    );

-- ---------- SEED ----------
-- 1) Match
INSERT INTO match (id, date, home_team, away_team, home_score, away_score)
VALUES (1, '2025-09-01 18:30:00+00', 'Blue FC', 'Red United', 2, 1)
    ON CONFLICT (id) DO NOTHING;

-- 2) Players
INSERT INTO player (id, name, team, position)
VALUES
    (1,  'Ali',     'Blue FC',    'FWD'),
    (2,  'Sami',    'Blue FC',    'MID'),
    (3,  'Yassine', 'Blue FC',    'DEF'),
    (11, 'Khaled',  'Red United', 'FWD'),
    (12, 'Omar',    'Red United', 'GK')
    ON CONFLICT (id) DO NOTHING;

-- 3) Events
INSERT INTO event (minute, type, player_id, meta) VALUES
                                                      (12, 'GOAL',   1,  '{"assistId": 2}'),
                                                      (43, 'SHOT',   1,  '{"onTarget": true}'),
                                                      (67, 'GOAL',   11, '{}'),
                                                      (75, 'TACKLE', 3,  '{}');
