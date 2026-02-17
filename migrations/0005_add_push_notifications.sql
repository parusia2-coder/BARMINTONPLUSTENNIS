-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  participant_name TEXT NOT NULL,
  participant_phone TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_tournament ON push_subscriptions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_name ON push_subscriptions(tournament_id, participant_name);

-- Notification log (track sent notifications to avoid duplicates)
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  participant_name TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id, participant_name, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notif_log_match ON notification_logs(match_id, notification_type);
