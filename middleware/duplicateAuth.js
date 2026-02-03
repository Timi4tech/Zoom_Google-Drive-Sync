const { getZoomToken } = require('./zoomApi');
const { fetchZoomRecordings, downloadFromZoom, cleanupTempFile } = require('./zoomApi');
const { uploadToGoogleDrive, uploadLargeFileToGoogleDrive } = require('./googleDriveFunctions');
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
  console.log('📄 Starting sync...', syncStarted.toISOString());
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

    // STEP 4: Process recordings
    const token = await getZoomToken();

    for (const recording of recordings) {
      // CHECK FOR DUPLICATE RECORDING
      if (syncedRecordingsSet.has(recording.uuid)) {
        console.log(`❌ SKIPPED (duplicate): ${recording.topic}`);
        duplicateCount++;
        continue; // Skip to next recording
      }

      // Process NEW recording
      console.log(`\n📹 Processing NEW: ${recording.topic}`);
      let uploadedAnyFile = false;

      // 🔧 CRITICAL: Register recording FIRST
      try {
        await markRecordingAsSynced(recording);
        syncedRecordingsSet.add(recording.uuid);
        console.log(`  ✓ Recording registered in database`);
      } catch (dbError) {
        console.error(`  ✗ Failed to register recording:`, dbError.message);
        errors = dbError.message;
        status = 'partial';
        continue; // Skip this recording
      }

      // Process each file in the recording
      for (const file of recording.recording_files) {
        // Declare variables for this file
        let fileType = null;
        let fileName = null;
        let mimeType = null;
        let tempFilePath = null;

        // Only process video (MP4) and audio (M4A) files
        if (file.file_type === 'MP4' || file.file_type === 'M4A') {
          // Set file variables
          fileType = file.file_type === 'MP4' ? 'video' : 'audio';
          fileName = `${recording.topic} - ${fileType.toUpperCase()} - ${new Date(recording.start_time).toISOString().split('T')[0]}`;
          mimeType = file.file_type === 'MP4' ? 'video/mp4' : 'audio/mp4';

          try {
            // Download from Zoom to temp file
            console.log(`  ⬇️  Downloading ${fileType}...`);
            const { filePath, size } = await downloadFromZoom(
              file.download_url, 
              token, 
              `${fileName}.${file.file_type.toLowerCase()}`
            );
            tempFilePath = filePath;

            // Upload to Google Drive from temp file
            console.log(`  ⬆️  Uploading to Google Drive...`);
            
            let driveFile;
            // Use chunked upload for files larger than 50MB
            if (size > 50 * 1024 * 1024) {
              driveFile = await uploadLargeFileToGoogleDrive(fileName, tempFilePath, mimeType, size);
            } else {
              driveFile = await uploadToGoogleDrive(fileName, tempFilePath, mimeType, size);
            }

            // Save to database
            await saveDriveFile(driveFile, fileType, recording.uuid);
            uploadedAnyFile = true;

            console.log(`  ✓ SUCCESS: ${fileName}`);
            newCount++;
            
          } catch (fileError) {
            console.error(`  ✗ FAILED: ${fileName}`, fileError.message);
            errors = fileError.message;
            status = 'partial';
            
          } finally {
            // Clean up temp file
            if (tempFilePath) {
              cleanupTempFile(tempFilePath);
            }
          }
        }
      }

      // Summary for this recording
      if (!uploadedAnyFile) {
        console.warn(`  ⚠️ No files uploaded for: ${recording.topic}`);
      }
    }
    
    const syncCompleted = new Date();
    
    console.log('\n===========================================');
    console.log('✅ Sync completed successfully!');
    console.log(`📊 New files uploaded: ${newCount}`);
    console.log(`⊗ Duplicates skipped: ${duplicateCount}`);
    console.log(`⏱️  Duration: ${((syncCompleted - syncStarted) / 1000).toFixed(2)}s`);
    console.log('===========================================\n');

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
    console.error('Stack trace:', error.stack);
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
  } 
}

module.exports = { syncRecordings };