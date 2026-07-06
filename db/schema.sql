CREATE TABLE IF NOT EXISTS route (
  id              TEXT PRIMARY KEY,
  origin          TEXT NOT NULL,
  dest            TEXT NOT NULL,
  trip_type       TEXT NOT NULL CHECK (trip_type IN ('one_way','round_trip')),
  stay_min        INT,
  stay_max        INT,
  stay_rep        INT,
  tier            TEXT NOT NULL CHECK (tier IN ('P0','P1','P2')),
  nearby_airports JSONB NOT NULL DEFAULT '[]',
  enabled         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS price_snapshot (
  id           BIGSERIAL PRIMARY KEY,
  route_id     TEXT NOT NULL REFERENCES route(id),
  variant      TEXT,                -- 邻近机场替换码；NULL = 原始航线
  depart_date  DATE NOT NULL,
  return_date  DATE,
  price        NUMERIC(10,2) NOT NULL,
  currency     TEXT NOT NULL,
  carrier      TEXT,
  stops        INT,
  depart_time  TIMESTAMPTZ,
  arrive_time  TIMESTAMPTZ,
  is_calendar  BOOLEAN NOT NULL,
  provider     TEXT NOT NULL,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snap_route_date ON price_snapshot (route_id, depart_date, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_snap_calendar   ON price_snapshot (route_id, is_calendar, captured_at DESC);

CREATE TABLE IF NOT EXISTS baseline (
  route_id       TEXT NOT NULL REFERENCES route(id),
  travel_month   TEXT NOT NULL,      -- 'YYYY-MM'
  lead_bucket    TEXT NOT NULL CHECK (lead_bucket IN ('L0','L1','L2')),
  p10            NUMERIC(10,2),
  p15            NUMERIC(10,2),
  p25            NUMERIC(10,2),
  p50            NUMERIC(10,2),
  sample_n       INT NOT NULL DEFAULT 0,
  low_confidence BOOLEAN NOT NULL DEFAULT TRUE,
  source         TEXT NOT NULL CHECK (source IN ('self','coldstart')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, travel_month, lead_bucket, source)
);

CREATE TABLE IF NOT EXISTS trip_intent (
  id          BIGSERIAL PRIMARY KEY,
  route_id    TEXT NOT NULL REFERENCES route(id),
  date_center DATE NOT NULL,
  flex_days   INT NOT NULL DEFAULT 3,
  pax         INT NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunity (
  id                     BIGSERIAL PRIMARY KEY,
  type                   TEXT NOT NULL CHECK (type IN ('baseline_breach','date_shift','nearby_airport','self_transfer')),
  route_id               TEXT NOT NULL REFERENCES route(id),
  depart_date            DATE,
  return_date            DATE,
  base_price             NUMERIC(10,2) NOT NULL,
  alt_price              NUMERIC(10,2) NOT NULL,
  saving                 NUMERIC(10,2) NOT NULL,
  detail                 JSONB NOT NULL DEFAULT '{}',
  evidence_snapshot_ids  BIGINT[] NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_card (
  opportunity_id BIGINT PRIMARY KEY REFERENCES opportunity(id),
  tags           JSONB NOT NULL DEFAULT '[]',
  hard_block     BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason   TEXT
);

CREATE TABLE IF NOT EXISTS alert (
  id             BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES opportunity(id),
  dedup_key      TEXT NOT NULL,
  channel        TEXT NOT NULL DEFAULT 'feishu',
  status         TEXT NOT NULL CHECK (status IN ('sent','queued_weekly','suppressed_dedup','suppressed_mute')),
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alert_dedup ON alert (dedup_key, sent_at DESC);

CREATE TABLE IF NOT EXISTS purchase (
  id                        BIGSERIAL PRIMARY KEY,
  alert_id                  BIGINT REFERENCES alert(id),
  route_id                  TEXT NOT NULL REFERENCES route(id),
  paid_price                NUMERIC(10,2) NOT NULL,
  baseline_p50_at_purchase  NUMERIC(10,2),
  saving                    NUMERIC(10,2),
  purchased_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_usage (
  provider TEXT NOT NULL,
  day      DATE NOT NULL,
  used     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, day)
);

CREATE TABLE IF NOT EXISTS route_mute (
  route_id   TEXT PRIMARY KEY REFERENCES route(id),
  mute_until TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_log (
  id       BIGSERIAL PRIMARY KEY,
  day      DATE NOT NULL,
  provider TEXT NOT NULL,
  requests INT NOT NULL DEFAULT 0,
  ok       INT NOT NULL DEFAULT 0,
  degraded INT NOT NULL DEFAULT 0,
  failed   INT NOT NULL DEFAULT 0,
  UNIQUE (day, provider)
);
