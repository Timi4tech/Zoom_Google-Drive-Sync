
const db = require('../db/pool');

async function getSyncedRecordingIds() {
  try {
    const result = await db.query('SELECT zoom_uuid FROM synced_recordings');
    return new Set(result.rows.map(row => row.zoom_uuid));
  } catch (error) {
    console.error('Error getting synced recordings:', error.message);
    return new Set();
  }
}

async function markRecordingAsSynced(recording) {
  try {
    await db.query(
      `INSERT INTO synced_recordings (zoom_uuid, zoom_topic, recording_date) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (zoom_uuid) DO NOTHING`,
      [recording.uuid, recording.topic, recording.start_time]
    );
  } catch (error) {
    console.error('Error marking recording as synced:', error.message);
    throw error;
  }
}

async function saveDriveFile(driveFile, fileType, recordingId) {
  try {
    await db.query(
      `INSERT INTO drive_files 
       (drive_id, name, web_view_link, created_time, size, mime_type, file_type, recording_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        driveFile.id,
        driveFile.name,
        driveFile.webViewLink,
        driveFile.createdTime,
        driveFile.size || 0,
        fileType === 'video' ? 'video/mp4' : 'audio/mp4',
        fileType,
        recordingId
      ]
    );
  } catch (error) {
    console.error('Error saving drive file:', error.message);
    throw error;
  }
}

async function logSync(syncData) {
  try {
    await db.query(
      `INSERT INTO sync_logs 
       (sync_started_at, sync_completed_at, new_recordings_count, duplicates_skipped_count, errors, status) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        syncData.started,
        syncData.completed,
        syncData.newCount,
        syncData.duplicateCount,
        syncData.errors,
        syncData.status
      ]
    );
  } catch (error) {
    console.error('Error logging sync:', error.message);
  }
}

module.exports = {
  getSyncedRecordingIds,
  markRecordingAsSynced,
  saveDriveFile,
  logSync
}