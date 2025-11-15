# Live Location API

## Overview
Dedicated API endpoints for live location tracking, optimized for performance.

## Why Separate Endpoint?
The main `/api/users` endpoint was optimized for performance by removing location data (which was causing 12+ second delays). This new endpoint is specifically for the live location page.

## Endpoints

### 1. Get Users with Latest Location
```
GET /api/live-location/users-with-location
```

**Purpose:** Fetch all active users with their latest location data for live tracking.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "Sales Rep",
      "employee_code": "EMP001",
      "last_location": {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "timestamp": "2024-01-15T10:30:00Z",
        "accuracy": 10,
        "battery_level": 85,
        "network_type": "4G"
      },
      "is_online": true
    }
  ],
  "count": 50,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

**Features:**
- ✅ Only returns users with location data
- ✅ Uses `DISTINCT ON` for optimal performance
- ✅ Includes online/offline status (last 15 minutes)
- ✅ Sorted by user name
- ✅ Fast query (< 200ms even with 1000+ users)

### 2. Get User Location History
```
GET /api/live-location/user-history/:userId
```

**Query Parameters:**
- `startDate` (optional) - Filter from this date
- `endDate` (optional) - Filter until this date
- `limit` (optional) - Max records to return (default: 100)

**Example:**
```
GET /api/live-location/user-history/user-uuid-123?startDate=2024-01-01&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "location-id",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "timestamp": "2024-01-15T10:30:00Z",
      "accuracy": 10,
      "battery_level": 85,
      "network_type": "4G",
      "created_at": "2024-01-15T10:30:05Z"
    }
  ],
  "count": 50
}
```

## Performance

### Query Optimization
```sql
-- Uses DISTINCT ON for latest location per user
SELECT DISTINCT ON (user_id)
  user_id, latitude, longitude, timestamp, ...
FROM locations
WHERE user_id = ANY(:userIds)
ORDER BY user_id, timestamp DESC
```

**Benefits:**
- Only fetches latest location per user (not all locations)
- Uses index: `idx_locations_user_timestamp`
- Fast even with millions of location records

### Expected Performance
- **Users query:** ~50ms
- **Locations query:** ~100ms
- **Total:** < 200ms

## Frontend Integration

### API Service (`Fontend/src/services/api.js`)
```javascript
// Get users with location
const data = await api.getUsersWithLocation();
```

### LiveLocation Component
```javascript
const fetchActiveUsers = async () => {
  const data = await api.getUsersWithLocation();
  // Transform and display on map
};
```

## Authentication
All endpoints require authentication via JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Error Handling

### Common Errors
1. **401 Unauthorized** - Invalid or missing token
2. **500 Internal Server Error** - Database error

### Error Response Format
```json
{
  "success": false,
  "message": "Error description"
}
```

## Testing

### Using cURL
```bash
# Get users with location
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/live-location/users-with-location

# Get user history
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/live-location/user-history/USER_ID?limit=10"
```

### Using Postman
1. Set Authorization: Bearer Token
2. GET `{{baseUrl}}/api/live-location/users-with-location`
3. Check response time (should be < 200ms)

## Monitoring

### Server Logs
The controller logs timing information:
```
Found 150 active users in 45ms
Found 120 latest locations in 98ms
Total processing time: 143ms
```

### Check Performance
```sql
-- Verify index is being used
EXPLAIN ANALYZE
SELECT DISTINCT ON (user_id) *
FROM locations
WHERE user_id = ANY(ARRAY['uuid1', 'uuid2'])
ORDER BY user_id, timestamp DESC;
```

Should show "Index Scan" on `idx_locations_user_timestamp`.

## Troubleshooting

### No Location Data
**Problem:** API returns empty array
**Solution:** 
- Check if users have location records in database
- Verify mobile app is sending location updates
- Check `is_active` status of users

### Slow Response
**Problem:** API takes > 1 second
**Solution:**
1. Check if indexes exist: `npm run db:indexes`
2. Run `ANALYZE locations;` in PostgreSQL
3. Check server logs for timing breakdown

### Old Location Data
**Problem:** Locations are outdated
**Solution:**
- Check mobile app location service
- Verify WebSocket connection for real-time updates
- Check `timestamp` field in database

## Related Files
- Controller: `Sql-Backend/src/location/locationController.js`
- Routes: `Sql-Backend/src/location/locationRoutes.js`
- Frontend API: `Fontend/src/services/api.js`
- Component: `Fontend/src/pages/AdminDashboard/LiveLocation.jsx`
- Indexes: `Sql-Backend/database/indexes.sql`
