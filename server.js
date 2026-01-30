const express = require('express');
const cron = require('node-cron');
const cors = require('cors');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { syncRecordings } = require('./middleware/duplicateAuth');
const routes = require('./routes');
const app = express();
const  {createUserTable} = require('./db/schema');


const PORT = process.env.PORT || 3001;
//Trust proxy for secure cookies in production
app.set('trust proxy', 1);
// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

 //Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Zoom to Drive Backend API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  },
});
app.use(csrfProtection);
// Initialize DB schema
createUserTable();
// Schedule periodic sync
const cronPattern = `*/${process.env.SYNC_INTERVAL_MINUTES} * * * *`;
cron.schedule(cronPattern, () => {
  console.log('⏰ Scheduled sync triggered');
  syncRecordings();
});
app.use("/api", routes);

// Run initial sync on startup
console.log('🚀 Server starting...');
syncRecordings();

 //404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`📅 Auto-sync scheduled every ${process.env.SYNC_INTERVAL_MINUTES} minutes`);
});

//Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);