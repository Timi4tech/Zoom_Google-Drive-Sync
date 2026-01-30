const { syncRecordings } = require('./middleware/duplicateAuth');

syncRecordings()
syncRecordings().then(() => {
  console.log('✅ Initial sync completed successfully');
}).catch(err => {
  console.error('❌ Initial sync failed:', err);
})
