const pool = require('./pool');

const createUserTable = async () => {
  const queryText = `
   
CREATE TABLE IF NOT EXISTS synced_recordings (
  id SERIAL PRIMARY KEY,
  zoom_uuid VARCHAR(255) UNIQUE NOT NULL,
  zoom_topic VARCHAR(500),
  recording_date TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_zoom_uuid ON synced_recordings(zoom_uuid);


CREATE TABLE IF NOT EXISTS drive_files (
  id SERIAL PRIMARY KEY,
  drive_id VARCHAR(255) UNIQUE NOT NULL,
  name TEXT NOT NULL,
  web_view_link TEXT NOT NULL,
  created_time TIMESTAMP NOT NULL,
  size BIGINT,
  mime_type VARCHAR(100),
  file_type VARCHAR(50) CHECK (file_type IN ('video', 'audio')),
  recording_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_drive_files_recording
    FOREIGN KEY (recording_id)
    REFERENCES synced_recordings(zoom_uuid)
    ON DELETE CASCADE
);



CREATE INDEX IF NOT EXISTS idx_drive_id ON drive_files(drive_id);
CREATE INDEX IF NOT EXISTS idx_created_time ON drive_files(created_time DESC);


CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  sync_started_at TIMESTAMP,
  sync_completed_at TIMESTAMP,
  new_recordings_count INTEGER DEFAULT 0,
  duplicates_skipped_count INTEGER DEFAULT 0,
  errors TEXT,
  status VARCHAR(50), -- 'success', 'partial', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);`;

  try {
    await pool.query('BEGIN');
await pool.query(queryText);
await pool.query('COMMIT');
    console.log('Tables created successfully');
  } catch (err) {
    console.error('Error creating tables', err);
  } 
};
module.exports = { createUserTable };