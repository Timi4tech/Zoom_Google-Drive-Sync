
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
async function getZoomToken() {
  try {
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      `https://zoom.us/oauth/token`,
       // 👈 no body for this request
      
        {
          grant_type: 'account_credentials',
          account_id: process.env.ZOOM_ACCOUNT_ID,
        },

        {headers: {
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

    // last 30 days (Zoom expects YYYY-MM-DD)
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const response = await axios.get(
      'https://api.zoom.us/v2/users/me/recordings',
      {
        params: {
          page_size: 2,
          from: fromDate,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.meetings ?? [];
  } catch (error) {
    console.error(
      'Error fetching Zoom recordings:',
      error.response?.data || error.message
    );
    throw error;
  }
}

async function downloadFromZoom(downloadUrl, token, fileName = 'file') {
  try {
    console.log(`📥 Starting download: ${fileName}`);
    
    const response = await axios.get(downloadUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
      responseType: 'stream',
    });

    const totalBytes = parseInt(response.headers['content-length'], 10);
    let downloadedBytes = 0;

    // Add progress tracking to the stream
    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      if (totalBytes) {
        const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
        const totalMB = (totalBytes / 1024 / 1024).toFixed(2);
        process.stdout.write(`\r📥 Download: ${progress}% (${downloadedMB} MB / ${totalMB} MB)`);
      }
    });

    response.data.on('end', () => {
      console.log('\n✅ Download complete');
    });

    return { stream: response.data, size: totalBytes };
  } catch (error) {
    console.error('\n❌ Error downloading from Zoom:', error.message);
    throw error;
  }
}
module.exports = {
  getZoomToken,
  fetchZoomRecordings,
  downloadFromZoom
};