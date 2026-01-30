
const {getZoomToken} = require('./zoomApi')
const {fetchZoomRecordings,downloadFromZoom} = require('./zoomApi');
const {uploadToGoogleDrive} = require('./googleDriveFunctions');
const {
  getSyncedRecordingIds,
  markRecordingAsSynced,
  saveDriveFile,
  logSync
} = require('../db/querry');

async function syncRecordings() {
 

  const syncStarted = new Date();
  let newCount = 0;
  let duplicateCount = 0;
  let errors = null;
  let status = 'success';

  console.log('\n===========================================');
  console.log('🔄 Starting sync...', syncStarted.toISOString());
  console.log('===========================================\n');

  try {
    // STEP 1: Get all previously synced recording IDs
    const syncedRecordingsSet = await getSyncedRecordingIds();
    console.log(`📊 Total recordings already synced: ${syncedRecordingsSet.size}`);

    // STEP 2: Fetch latest recordings from Zoom
    console.log('📥 Fetching recordings from Zoom...');
    const recordings = await fetchZoomRecordings();
    console.log(`✓ Found ${recordings.length} total recordings`);

    // STEP 3: Sort by date (latest first)
    recordings.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    // STEP 4: Filter out duplicates and process only NEW recordings
    const token = await getZoomToken();

    for (const recording of recordings) {
     
      // CHECK FOR DUPLICATE
      if (syncedRecordingsSet.has(recording.uuid)) {
        console.log(`⊗ SKIPPED (duplicate): ${recording.topic}`);
        duplicateCount++;
        continue; // Skip to next recording
      }

      // Process NEW recording
      console.log(`\n📹 Processing NEW: ${recording.topic}`);
      await markRecordingAsSynced(recording);
      syncedRecordingsSet.add(recording.uuid);
       let uploadedAnyFile = false;

      for (const file of recording.recording_files) {
        // Only process video (MP4) and audio (M4A) files
        if (file.file_type === 'MP4' || file.file_type === 'M4A') {
          const fileType = file.file_type === 'MP4' ? 'video' : 'audio';
          const fileName = `${recording.topic} - ${fileType.toUpperCase()} - ${new Date(recording.start_time).toISOString().split('T')[0]}`;
          const mimeType = file.file_type === 'MP4' ? 'video/mp4' : 'audio/mp4';

          try {
            // Download from Zoom
            console.log(`  ⬇️  Downloading ${fileType}...`);
            const {stream,size} = await downloadFromZoom(file.download_url, token);

            // Upload to Google Drive
            console.log(`  ⬆️  Uploading to Google Drive...`);
            const driveFile = await uploadToGoogleDrive(fileName, stream, mimeType, size);

            // Save to database
            await saveDriveFile(driveFile, fileType, recording.uuid);
                 uploadedAnyFile = true;

            console.log(`  ✓ SUCCESS: ${fileName}`);
            newCount++;
          } catch (fileError) {
            console.error(`  ✗ FAILED: ${fileName}`, fileError.message);
            errors = fileError.message;
            status = 'partial';
          }
        }
      }

      // Mark recording as synced (prevents future duplicates)
      
      

      if (!uploadedAnyFile) {
  console.warn(`⚠️ No files uploaded for: ${recording.topic}`);
    }
  }
    const syncCompleted = new Date();

    // Log sync to database
    await logSync({
      started: syncStarted,
      completed: syncCompleted,
      newCount,
      duplicateCount,
      errors,
      status
    });

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    status = 'failed';
    errors = error.message;
    
    await logSync({
      started: syncStarted,
      completed: new Date(),
      newCount,
      duplicateCount,
      errors,
      status
    });
  } finally{
      console.log('\n===========================================');
    console.log('✅ Sync completed successfully!');
    console.log(`📊 New files uploaded: ${newCount}`);
    console.log(`⊗ Duplicates skipped: ${duplicateCount}`);
    console.log(`⏱️  Duration: ${((syncCompleted - syncStarted) / 1000).toFixed(2)}s`);
    console.log('===========================================\n');
  }
}

module.exports = { syncRecordings };