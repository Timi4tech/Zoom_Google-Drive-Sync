const { google } = require('googleapis');
const dotenv = require('dotenv');
dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: 'v3',
  auth: oAuth2Client,
});

async function ensureFreshAccessToken() {
  const { token } = await oAuth2Client.getAccessToken();

  if (!token) {
    throw new Error('Failed to acquire access token');
  }

  // Optional: log expiry for sanity
  const expiry = oAuth2Client.credentials.expiry_date;
  console.log(
    '🔐 Google token expires at:',
    expiry ? new Date(expiry).toISOString() : 'unknown'
  );
}


module.exports = {drive, oAuth2Client, ensureFreshAccessToken};

