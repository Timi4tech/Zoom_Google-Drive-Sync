// googleDriveFunctions.js
const { drive } = require('./googleOAuth');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

/**
 * Upload file to Google Drive with retry logic
 * Uses file path instead of stream to avoid timeout issues
 */
async function uploadToGoogleDrive(fileName, filePath, mimeType, fileSize = null) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
        throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables');
      }

      console.log(`📤 Uploading to Google Drive (attempt ${attempt}/${maxRetries}): ${fileName}`);

      // Create read stream from file
      const fileStream = fs.createReadStream(filePath);
      
      const response = await drive.files.create(
        {
          requestBody: {
            name: fileName,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
            mimeType,
          },
          media: {
            mimeType,
            body: fileStream,
          },
          fields: 'id, name, webViewLink, createdTime, size',
          supportsAllDrives: true,
        },
        {
          // Increase timeout for large files
          onUploadProgress: (evt) => {
            if (!fileSize) return;

            const progress = ((evt.bytesRead / fileSize) * 100).toFixed(1);
            const uploadedMB = (evt.bytesRead / 1024 / 1024).toFixed(2);
            const totalMB = (fileSize / 1024 / 1024).toFixed(2);

            process.stdout.write(
              `\r📤 Uploading: ${progress}% (${uploadedMB} MB / ${totalMB} MB)`
            );
          },
        }
      );
     if (response.status === 200 && response.statusText === 'OK') {
      console.log(`\n✅ Upload complete: ${fileName}`);

      // Make file publicly accessible
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      });
    }else{
      setTimeout(() => {
        maxRetries = 5;
        response()}, 5000); // wait for 2 seconds before next
         
    }
      return response.data;
      
    } catch (error) {
      lastError = error;
      console.error(`\n❌ Upload attempt ${attempt} failed:`, error.message);
      
    }
  }

}

/**
 * Alternative: Upload large files in chunks using resumable upload
 * This is more reliable for very large files (>100MB)
 */
async function uploadLargeFileToGoogleDrive(fileName, filePath, mimeType, fileSize) {
  try {
    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID not set in environment variables');
    }

    console.log(`📤 Starting chunked upload: ${fileName}`);

    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath),
    };

    // Use resumable upload with chunks
    const response = await drive.files.create(
      {
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, createdTime, size',
        supportsAllDrives: true,
      },
      {
        onUploadProgress: (evt) => {
          const progress = ((evt.bytesRead / fileSize) * 100).toFixed(1);
          const uploadedMB = (evt.bytesRead / 1024 / 1024).toFixed(2);
          const totalMB = (fileSize / 1024 / 1024).toFixed(2);
          process.stdout.write(
            `\r📤 Uploading: ${progress}% (${uploadedMB} MB / ${totalMB} MB)`
          );
        },
      }
    );

    console.log(`\n✅ Upload complete: ${fileName}`);

    if (response.status === 200 && response.statusText === 'OK') {
      console.log(`\n✅ Upload complete: ${fileName}`);

      // Make file publicly accessible
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      });
    }else{
      setTimeout(() => {
        maxRetries = 5;
        response()}, 5000); // wait for 5 seconds before next
         
    }

    return response.data;
    
  } catch (error) {
    console.error('\n❌ Large file upload failed:', error.message);
    throw error;
  }
}

module.exports = { 
  uploadToGoogleDrive,
  uploadLargeFileToGoogleDrive 
};