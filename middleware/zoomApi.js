const axios = require('axios');
const dotenv = require('dotenv');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');
const os = require('os');

dotenv.config();

async function getZoomToken() {
  try {
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      `https://zoom.us/oauth/token`,
      qs.stringify({ 
        grant_type: 'account_credentials',
        account_id: process.env.ZOOM_ACCOUNT_ID,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error(
      'Error getting Zoom token:',
      error.response?.data || error.message
    );
    throw error;
  }
}

async function fetchZoomRecordings() {
  try {
    const token = await getZoomToken();

    // last 2 days (Zoom expects YYYY-MM-DD)
    const fromDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/recordings',
      {
        params: {
          page_size: 4,
          from: fromDate,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  console.log(`✓ Fetched ${response.data.meetings.length} recordings from Zoom`);
    return response.data.meetings ?? [];
  } catch (error) {
    console.error(
      'Error fetching Zoom recordings:',
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Download from Zoom and save to temporary file
 * This prevents stream timeout issues with Google Drive
 */
async function downloadFromZoom(downloadUrl, token, fileName = 'file') {
  try {
    console.log(`📥 Starting download: ${fileName}`);
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'zoom-recordings');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create temp file path
    const tempFilePath = path.join(tempDir, `${Date.now()}-${fileName}`);
    
    const response = await axios.get(downloadUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      responseType: 'stream',
      timeout: 300000, // 5 minute timeout
    });

    const totalBytes = parseInt(response.headers['content-length'], 10);
    let downloadedBytes = 0;
    
    // Create write stream to temp file
    const writer = fs.createWriteStream(tempFilePath);

    // Track progress
    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes) {
        const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
        const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
        process.stdout.write(`\r📥 Download: ${progress}% (${downloadedMB} MB / ${totalMB} MB)`);
      }
    });

    // Pipe to file
    response.data.pipe(writer);

    // Wait for download to complete
    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('\n✅ Download complete');
        resolve();
      });
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    return { 
      filePath: tempFilePath, 
      size: totalBytes 
    };
  } catch (error) {
    console.error('\n❌ Error downloading from Zoom:', error.message);
    throw error;
  }
}

/**
 * Clean up temporary file
 */
function cleanupTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Cleaned up temp file: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`Warning: Could not delete temp file ${filePath}:`, error.message);
  }
}

module.exports = {
  getZoomToken,
  fetchZoomRecordings,
  downloadFromZoom,
  cleanupTempFile
};