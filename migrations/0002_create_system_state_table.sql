-- Table to track global indexing state (only one row used)
CREATE TABLE IF NOT EXISTS system_state (
  id SERIAL PRIMARY KEY,
  total_shares DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_update BIGINT NOT NULL DEFAULT 0
);

-- Insert a default row for system_state on first run if none exists
INSERT INTO system_state (id, total_shares, last_update)
SELECT 1, 0, 0
WHERE NOT EXISTS (SELECT * FROM system_state);
