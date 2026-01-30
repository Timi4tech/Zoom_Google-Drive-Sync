// googleDriveFunctions.js
const {drive} = require('./googleOAuth');
const dotenv = require('dotenv');
dotenv.config();

async function uploadToGoogleDrive(fileName, fileStream, mimeType, fileSize = null) {
  try {
    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables');
    }

    console.log(`📤 Uploading to Google Drive: ${fileName}`);

    // Add progress tracking if we have size
    if (fileSize) {
      let uploadedBytes = 0;
      fileStream.on('data', (chunk) => {
        uploadedBytes += chunk.length;
        const progress = ((uploadedBytes / fileSize) * 100).toFixed(1);
        const uploadedMB = (uploadedBytes / 1024 / 1024).toFixed(2);
        const totalMB = (fileSize / 1024 / 1024).toFixed(2);
        process.stdout.write(`\r📤 Upload: ${progress}% (${uploadedMB} MB / ${totalMB} MB)`);
      });

      fileStream.on('end', () => {
        console.log(''); // New line after progress
      });
    }

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: mimeType,
        body: fileStream, // Stream directly
      },
      fields: 'id, name, webViewLink, createdTime, size',
      supportsAllDrives: true,
    });

    console.log(`✅ Upload complete: ${fileName}`);

    // Make file accessible with link
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
      supportsAllDrives: true,
    });

    return response.data;
  } catch (error) {
    console.error('\n❌ Error uploading to Google Drive:', error.message);
    throw error;
  }
}

module.exports = { uploadToGoogleDrive };