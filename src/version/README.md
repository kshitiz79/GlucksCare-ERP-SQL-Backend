# Version Management with Automatic Cleanup

This system automatically manages app version checking and cleans up old version history data, keeping only the last 2 records per user.

## Features

- ✅ **Automatic Cleanup**: Keeps only the last 2 version records per user
- ✅ **Scheduled Cleanup**: Runs daily at 2:00 AM automatically
- ✅ **Manual Cleanup**: Admin can trigger cleanup manually
- ✅ **Performance Optimized**: Database indexes for fast cleanup operations
- ✅ **Statistics**: View cleanup statistics and recommendations

## Setup

### 1. Add to your main app file (app.js or server.js):

```javascript
// Import the setup function
const { setupVersionCleanup } = require('./src/version/setupVersionCleanup');

// Initialize after your app starts
setupVersionCleanup({
  enableScheduler: true,      // Enable automatic daily cleanup
  runInitialCleanup: true,    // Run cleanup on app start
  logLevel: 'info'           // Logging level
});
```

### 2. Install required dependency:

```bash
npm install node-cron
```

### 3. Run the migration to add database indexes:

```bash
npx sequelize-cli db:migrate --name add_version_indexes.js
```

## API Endpoints

### User Endpoints

#### Check App Version
```
POST /api/version/check
```
- Automatically triggers cleanup for the user after saving version data
- Keeps only the last 2 records for each user

### Admin Endpoints

#### Manual Cleanup
```
POST /api/version/admin/cleanup
Query Parameters:
- userId (optional): Clean up for specific user only
```

**Example:**
```javascript
// Cleanup all users
POST /api/version/admin/cleanup

// Cleanup specific user
POST /api/version/admin/cleanup?userId=user-uuid-here
```

#### Get Cleanup Statistics
```
GET /api/version/admin/cleanup-stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRecords": 1500,
    "totalUsers": 500,
    "usersWithMultipleRecords": 200,
    "recordsToCleanup": 800,
    "userStats": [...],
    "cleanupRecommendation": "800 records can be cleaned up"
  }
}
```

## How It Works

### Automatic Cleanup Process

1. **On Version Check**: Every time a user checks their app version, the system automatically cleans up old records for that user
2. **Scheduled Cleanup**: Runs daily at 2:00 AM to clean up all users
3. **Keep Last 2**: Always maintains the 2 most recent version records per user
4. **Performance**: Uses database indexes for fast cleanup operations

### Cleanup Logic

```javascript
// For each user:
// 1. Get all version records ordered by created_at DESC
// 2. Keep the first 2 records (most recent)
// 3. Delete all older records
// 4. Log the cleanup results
```

### Database Indexes

The system adds these indexes for optimal performance:

- `idx_versions_user_created`: Composite index on (user_id, created_at)
- `idx_versions_user_id`: Index on user_id
- `idx_versions_created_at`: Index on created_at

## Configuration Options

### Scheduler Configuration

```javascript
// Daily cleanup at 2:00 AM (default)
scheduleVersionCleanup();

// Or use frequent cleanup (every 6 hours)
scheduleFrequentCleanup();
```

### Custom Cleanup

```javascript
const { cleanupOldVersions } = require('./versionController');

// Cleanup all users
await cleanupOldVersions();

// Cleanup specific user
await cleanupOldVersions('user-uuid-here');
```

## Monitoring

### Logs

The system provides detailed logging:

```
✅ Cleaned up 5 old version records for user abc-123
✅ Total cleanup: Deleted 150 old version records
📅 Version cleanup scheduler initialized - runs daily at 2:00 AM
```

### Statistics API

Use the cleanup stats endpoint to monitor:

- Total records in database
- Users with multiple records
- Records that can be cleaned up
- Cleanup recommendations

## Benefits

1. **Storage Optimization**: Prevents unlimited growth of version history
2. **Performance**: Faster queries with fewer records
3. **Automatic**: No manual intervention required
4. **Configurable**: Flexible cleanup schedules and options
5. **Safe**: Always keeps the most recent data
6. **Monitored**: Full logging and statistics

## Troubleshooting

### If cleanup fails:

1. Check database connectivity
2. Verify user permissions
3. Check logs for specific errors
4. Use manual cleanup endpoint for testing

### Performance issues:

1. Ensure database indexes are created
2. Monitor cleanup frequency
3. Check database server resources

## Example Usage

```javascript
// In your main app file
const express = require('express');
const app = express();

// ... your app setup ...

// Initialize version cleanup system
const { setupVersionCleanup } = require('./src/version/setupVersionCleanup');
setupVersionCleanup({
  enableScheduler: true,
  runInitialCleanup: true
});

// Start server
app.listen(3000, () => {
  console.log('Server started with automatic version cleanup');
});
```

This system ensures your version history stays clean and performant while maintaining the essential data for app version management.