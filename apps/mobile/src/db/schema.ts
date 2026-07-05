export const schema = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS locations (id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY, item_name TEXT NOT NULL, ai_suggested_title TEXT, ai_description TEXT, user_description TEXT,
  category TEXT NOT NULL, location_id TEXT REFERENCES locations(id) ON DELETE SET NULL, location_text TEXT NOT NULL,
  room TEXT, make TEXT, model TEXT, serial_number TEXT, barcode TEXT, has_owner_marking INTEGER NOT NULL DEFAULT 0,
  owner_marking TEXT, marking_type TEXT, marking_location TEXT, marking_notes TEXT, distinguishing_features TEXT,
  purchase_date TEXT, purchase_price REAL, user_entered_value REAL,
  condition TEXT NOT NULL, status TEXT NOT NULL, notes TEXT, archived_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS valuation_records (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  estimated_low REAL, estimated_high REAL, selected_value REAL, currency TEXT NOT NULL DEFAULT 'USD',
  confidence TEXT, source_summary TEXT, checked_at TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS item_attachments (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  attachment_type TEXT NOT NULL, local_uri TEXT NOT NULL, mime_type TEXT, original_name TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, incident_date TEXT NOT NULL, location_text TEXT NOT NULL,
  owner_name TEXT, owner_phone TEXT, owner_email TEXT, owner_address TEXT, police_agency TEXT, police_case_number TEXT,
  insurance_company TEXT, insurance_claim_number TEXT, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incident_items (
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  status TEXT NOT NULL, notes TEXT, PRIMARY KEY(incident_id,item_id)
);
CREATE TABLE IF NOT EXISTS comparable_listings (
  id TEXT PRIMARY KEY, valuation_id TEXT NOT NULL REFERENCES valuation_records(id) ON DELETE CASCADE,
  title TEXT NOT NULL, marketplace TEXT NOT NULL, condition TEXT NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL,
  url TEXT NOT NULL, image_url TEXT, match_reason TEXT NOT NULL, match_confidence TEXT NOT NULL, checked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status, archived_at);
CREATE INDEX IF NOT EXISTS idx_item_attachments_item ON item_attachments(item_id, attachment_type);
CREATE INDEX IF NOT EXISTS idx_incident_date ON incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_valuation_item ON valuation_records(item_id, checked_at);
INSERT OR IGNORE INTO app_settings(key,value,updated_at) VALUES ('subscriptionTier','premium',datetime('now'));
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (1,datetime('now'));
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (2,datetime('now'));
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (3,datetime('now'));
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES (4,datetime('now'));
`;
