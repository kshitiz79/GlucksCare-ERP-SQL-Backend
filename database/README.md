# Database Performance Optimization

## Overview
This directory contains SQL scripts to optimize database performance, particularly for user-related queries that were experiencing slow response times (12+ seconds).

## Problem
The original queries were slow because:
1. **No pagination** - Fetching all users at once
2. **Inefficient location queries** - Fetching ALL location records then filtering in JavaScript
3. **Missing indexes** - Database had to scan entire tables
4. **N+1 queries** - Multiple round trips to database

## Solution

### 1. Database Indexes (`indexes.sql`)
Run this script to create essential indexes:

```bash
# Connect to your PostgreSQL database
psql -U your_username -d your_database -f database/indexes.sql

# Or if using a connection string
psql "postgresql://user:password@host:port/database" -f database/indexes.sql
```

**Critical indexes created:**
- `idx_users_is_active` - Fast filtering of active users
- `idx_users_role` - Fast role-based queries
- `idx_users_state_id` - Fast state-based queries
- `idx_locations_user_timestamp` - **MOST IMPORTANT** - Fast latest location per user
- `idx_user_head_offices_*` - Fast many-to-many joins

### 2. Query Optimizations

#### Before (Slow):
```javascript
// Fetched ALL locations for ALL users
const locationDetails = await Location.findAll({
  where: { user_id: userIds },
  order: [['timestamp', 'DESC']]
});
// Then filtered in JavaScript - SLOW!
```

#### After (Fast):
```javascript
// Get ONLY latest location per user using SQL
const locationDetails = await sequelize.query(`
  SELECT DISTINCT ON (user_id)
    user_id, latitude, longitude, timestamp, ...
  FROM locations
  WHERE user_id = ANY(:userIds)
  ORDER BY user_id, timestamp DESC
`, { replacements: { userIds }, type: sequelize.QueryTypes.SELECT });
```

### 3. Pagination Added

All user list endpoints now support pagination:

```javascript
GET /api/users?page=1&limit=50
GET /api/users?page=2&limit=100
```

**Default:** 50 users per page

## Performance Improvements

### Expected Results:
- **Before:** 12+ seconds for `/api/users`
- **After:** < 500ms for `/api/users` (with indexes and pagination)

### Monitoring Query Performance

The optimized code includes timing logs:

```javascript
console.log(`Found ${users.length} users in ${t1 - t0}ms`);
console.log(`Found ${locationDetails.length} latest locations in ${t2 - t1}ms`);
console.log(`Total query time: ${t2 - t0}ms`);
```

Check your server logs to see actual performance.

## Verification

### 1. Check if indexes exist:
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users';
```

### 2. Analyze query performance:
```sql
EXPLAIN ANALYZE
SELECT * FROM users WHERE is_active = true;
```

You should see "Index Scan" instead of "Seq Scan" if indexes are working.

### 3. Check index usage:
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'users'
ORDER BY idx_scan DESC;
```

## Additional Optimizations

### 1. Connection Pooling
Ensure your database connection pool is configured:

```javascript
// In your database config
{
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000
  }
}
```

### 2. Query Caching (Optional)
For frequently accessed data that doesn't change often:

```javascript
// Use Redis or in-memory cache
const cachedUsers = await cache.get('active_users');
if (cachedUsers) return cachedUsers;

const users = await User.findAll({ where: { is_active: true } });
await cache.set('active_users', users, 300); // Cache for 5 minutes
```

### 3. Database Maintenance
Run these periodically:

```sql
-- Update statistics for query planner
ANALYZE users;
ANALYZE locations;

-- Rebuild indexes if needed
REINDEX TABLE users;
REINDEX TABLE locations;

-- Vacuum to reclaim space
VACUUM ANALYZE users;
VACUUM ANALYZE locations;
```

## Troubleshooting

### Still slow after adding indexes?

1. **Check if indexes are being used:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM users WHERE is_active = true;
   ```

2. **Check table statistics:**
   ```sql
   SELECT * FROM pg_stat_user_tables WHERE relname = 'users';
   ```

3. **Check for table bloat:**
   ```sql
   SELECT 
     schemaname, tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

4. **Check connection pool:**
   - Are you running out of connections?
   - Is connection acquisition slow?

### VPS-specific issues:

1. **Check resources:**
   ```bash
   htop  # Check CPU and RAM
   iostat -x 1  # Check disk I/O
   ```

2. **Check PostgreSQL logs:**
   ```bash
   tail -f /var/log/postgresql/postgresql-*.log
   ```

3. **Tune PostgreSQL for your VPS:**
   ```sql
   -- Check current settings
   SHOW shared_buffers;
   SHOW work_mem;
   SHOW maintenance_work_mem;
   ```

## Support

If queries are still slow after applying these optimizations:
1. Check the timing logs to identify which query is slow
2. Run EXPLAIN ANALYZE on that specific query
3. Check if indexes are being used
4. Consider adding more specific indexes for your use case
