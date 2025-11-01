# Live Location System with Auto-Cleanup

## Overview
This system provides real-time location tracking with automatic data management and cleanup.

## Features Implemented

### 1. Real-Time Location Updates
- **Automatic Timestamps**: All location data uses current Indian time (Asia/Kolkata timezone)
- **WebSocket Integration**: Real-time updates to admin dashboard
- **Realistic Data**: Location simulation with realistic movement patterns

### 2. Automatic Data Cleanup
- **24-Hour Retention**: Automatically deletes location data older than 24 hours
- **Hourly Cleanup**: Runs cleanup process every hour
- **Database Optimization**: Keeps database size manageable

### 3. Auto-Start Services
- **Location Simulation**: Automatically starts realistic location simulation for active users
- **Background Services**: All services start automatically when server starts
- **No Manual Intervention**: System works automatically without manual controls

## API Endpoints

### Location Events
- `POST /api/location-events` - Receive location updates from mobile apps
- `GET /api/locations/admin/user-history/:userId` - Get user location history

### Auto Services (for testing/monitoring)
- `GET /api/mock-data/auto-status` - Check simulation status
- `POST /api/mock-data/auto-start` - Manually start simulation
- `POST /api/mock-data/auto-stop` - Stop simulation
- `GET /api/mock-data/cleanup-status` - Check cleanup service status
- `POST /api/mock-data/cleanup` - Run manual cleanup

## How It Works

### 1. Location Data Flow
```
Mobile App → POST /api/location-events → Database → WebSocket → Admin Dashboard
```

### 2. Automatic Timestamp Handling
- When location data is received, system automatically sets timestamp to current Indian time
- Frontend displays timestamps in Indian format with real-time updates
- Shows both relative time ("2m ago") and exact time ("01/11/2024, 1:30:45 PM")

### 3. Data Cleanup Process
- Runs every hour automatically
- Deletes location records older than 24 hours
- Deletes location events older than 24 hours
- Logs cleanup results

### 4. Auto-Simulation (for testing)
- Automatically starts when server starts
- Simulates realistic movement for first 5 users
- Updates every 15 seconds
- Uses realistic GPS coordinates around Delhi/NCR

## Configuration

### Cleanup Settings
- **Data Retention**: 24 hours (configurable)
- **Cleanup Interval**: 1 hour (configurable)
- **Auto-Start**: Enabled by default

### Simulation Settings
- **Update Interval**: 15 seconds
- **Users Simulated**: First 5 users from database
- **Movement Pattern**: Realistic routes with GPS noise

## Frontend Features

### Live Location Dashboard
- **Real-Time Clock**: Shows current Indian time
- **Connection Status**: WebSocket connection indicator
- **User Count**: Number of users with location data
- **Live Data Indicator**: Shows system is receiving real-time data

### User Information Display
- **Status**: Online/Offline based on last update time
- **Last Update**: Relative time (e.g., "2m ago")
- **Exact Time**: Full timestamp in Indian format
- **Location Details**: Coordinates and accuracy

## Database Tables

### Locations Table
- Stores current/latest location for each user
- Automatically cleaned up after 24 hours

### Location Events Table
- Stores all location update events
- Automatically cleaned up after 24 hours

## Server Startup
When the server starts:
1. Database connection established
2. Auto-cleanup service starts
3. Location simulation starts (after 5 second delay)
4. WebSocket server initialized
5. All services running automatically

## Testing

### Test Scripts
- `node test-cleanup.js` - Test cleanup functionality
- `node test-mock-data.js` - Test location simulation

### Manual Testing
- Check auto-status: `curl http://localhost:5051/api/mock-data/auto-status`
- Run manual cleanup: `curl -X POST http://localhost:5051/api/mock-data/cleanup`

## Benefits

1. **Automatic Operation**: No manual intervention required
2. **Real-Time Updates**: Live location tracking with WebSocket
3. **Data Management**: Automatic cleanup prevents database bloat
4. **Indian Time**: All timestamps in local timezone
5. **Realistic Testing**: Simulation provides realistic test data
6. **Scalable**: Handles multiple users efficiently

## Notes

- System automatically handles timezone conversion to Indian time
- Cleanup service prevents database from growing indefinitely
- Location simulation provides realistic test data for development
- All services are designed to run continuously without manual management