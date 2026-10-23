CREATE TABLE IF NOT EXISTS pins (id TEXT PRIMARY KEY, name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, kind TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS votes (pin_id TEXT NOT NULL, actor TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(pin_id,actor));
CREATE TABLE IF NOT EXISTS heat_reports (id TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL, feeling TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS pins_area ON pins(latitude,longitude,created_at);
CREATE INDEX IF NOT EXISTS reports_area ON heat_reports(latitude,longitude,created_at);
