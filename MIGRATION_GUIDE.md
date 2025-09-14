# MongoDB to PostgreSQL Migration Guide

## Overview
This document provides a comprehensive guide for migrating the GlucksCare ERP system from MongoDB to PostgreSQL, including data mapping strategies, API compatibility considerations, and trade-offs.

## Entity Relationship Diagram (ERD) Description

### Core Entities and Relationships

#### 1. User Management Hierarchy
```
States (1) ←→ (M) HeadOffices (1) ←→ (M) Users
Users (M) ←→ (M) UserHeadOffices (Many-to-Many)
Users (M) ←→ (M) UserManagers (Self-referencing hierarchy)
Users (M) ←→ (M) UserShifts ←→ (M) Shifts
```

#### 2. Attendance & Leave Management
```
Users (1) ←→ (M) Attendance
Users (1) ←→ (M) Leaves ←→ (1) LeaveTypes
Holidays (M) ←→ (M) States (Many-to-Many via array)
Shifts (1) ←→ (M) PayrollSettings
```

#### 3. Business Entities
```
HeadOffices (1) ←→ (M) Doctors
HeadOffices (1) ←→ (M) Chemists
HeadOffices (1) ←→ (M) Stockists

Doctors (1) ←→ (M) DoctorVisitHistory
Doctors (1) ←→ (M) DoctorVisits ←→ (1) Users
Chemists (1) ←→ (M) ChemistVisits ←→ (1) Users
Stockists (1) ←→ (M) StockistVisits ←→ (1) Users
```

#### 4. Sales & Products
```
Users (1) ←→ (M) SalesActivities
Users (1) ←→ (M) SalesTargets
Users (1) ←→ (M) Orders
Products (M) ←→ (M) VisitProducts (Many-to-Many)
```

#### 5. Location Tracking
```
Users (1) ←→ (M) Locations
Users (1) ←→ (M) LocationHistory
Users (1) ←→ (M) StopEvents
Users (1) ←→ (1) RealTimeLocations
```

## Data Type Mappings

### MongoDB → PostgreSQL Type Conversions

| MongoDB Type | PostgreSQL Type | Notes |
|--------------|-----------------|-------|
| `ObjectId` | `UUID` | Use `uuid_generate_v4()` for new records |
| `String` | `VARCHAR(n)` or `TEXT` | Size limits based on field usage |
| `Number` | `INTEGER`, `DECIMAL`, `BIGINT` | Based on value range and precision |
| `Boolean` | `BOOLEAN` | Direct mapping |
| `Date` | `TIMESTAMP WITH TIME ZONE` | Preserves timezone information |
| `Array` | `TEXT[]` or separate table | Depends on complexity |
| `Object` | `JSONB` | For flexible/nested structures |
| `Mixed` | `JSONB` | For dynamic schemas |

### Specific Field Mappings

#### User Schema
```javascript
// MongoDB
{
  _id: ObjectId,
  employeeCode: String,
  headOffices: [ObjectId], // Array of references
  bankDetails: {           // Embedded object
    bankName: String,
    accountNo: String
  }
}
```

```sql
-- PostgreSQL
CREATE TABLE users (
    id UUID PRIMARY KEY,
    employee_code VARCHAR(100) UNIQUE,
    bank_details JSONB  -- Flexible structure preserved
);

CREATE TABLE user_head_offices (
    user_id UUID REFERENCES users(id),
    head_office_id UUID REFERENCES head_offices(id)
);
```

#### Attendance Schema
```javascript
// MongoDB - Complex nested structure
{
  punchSessions: [{
    punchIn: Date,
    punchOut: Date,
    punchInLocation: {
      latitude: Number,
      longitude: Number
    }
  }]
}
```

```sql
-- PostgreSQL - JSONB for complex structure
CREATE TABLE attendance (
    id UUID PRIMARY KEY,
    punch_sessions JSONB NOT NULL DEFAULT '[]'
    -- Structure: [{"punchIn": "2024-01-01T09:00:00Z", "punchOut": "2024-01-01T18:00:00Z", "punchInLocation": {"latitude": 28.6139, "longitude": 77.2090}}]
);
```

## Migration Strategies

### 1. Reference Relationships (ObjectId → UUID)

#### Strategy A: Generate New UUIDs
```javascript
// Migration script example
const oldToNewIdMap = new Map();

// First pass: Create records with new UUIDs
for (const mongoDoc of mongoCollection) {
  const newUuid = uuidv4();
  oldToNewIdMap.set(mongoDoc._id.toString(), newUuid);
  
  await pgClient.query(
    'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
    [newUuid, mongoDoc.name, mongoDoc.email]
  );
}

// Second pass: Update references
for (const mongoDoc of mongoCollection) {
  if (mongoDoc.managerId) {
    const newManagerId = oldToNewIdMap.get(mongoDoc.managerId.toString());
    await pgClient.query(
      'UPDATE users SET manager_id = $1 WHERE id = $2',
      [newManagerId, oldToNewIdMap.get(mongoDoc._id.toString())]
    );
  }
}
```

#### Strategy B: Preserve Original IDs (if compatible)
```javascript
// Convert ObjectId to UUID format
function objectIdToUuid(objectId) {
  const hex = objectId.toString();
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,24)}`;
}
```

### 2. Array Fields Migration

#### Simple Arrays → PostgreSQL Arrays
```javascript
// MongoDB
{ workDays: ['Monday', 'Tuesday', 'Wednesday'] }
```

```sql
-- PostgreSQL
work_days TEXT[] -- {'Monday', 'Tuesday', 'Wednesday'}
```

#### Complex Arrays → Separate Tables
```javascript
// MongoDB
{
  visit_history: [{
    date: Date,
    notes: String,
    salesRep: ObjectId
  }]
}
```

```sql
-- PostgreSQL - Normalized
CREATE TABLE doctor_visit_history (
    id UUID PRIMARY KEY,
    doctor_id UUID REFERENCES doctors(id),
    date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    sales_rep_id UUID REFERENCES users(id)
);
```

### 3. Embedded Objects Migration

#### Keep as JSONB (Recommended for flexible schemas)
```javascript
// MongoDB
{
  bankDetails: {
    bankName: "HDFC Bank",
    accountNo: "123456789",
    ifscCode: "HDFC0001234"
  }
}
```

```sql
-- PostgreSQL
bank_details JSONB
-- Value: {"bankName": "HDFC Bank", "accountNo": "123456789", "ifscCode": "HDFC0001234"}
```

#### Normalize to Separate Table (For structured data)
```sql
CREATE TABLE user_bank_details (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES users(id),
    bank_name VARCHAR(255),
    account_no VARCHAR(50),
    ifsc_code VARCHAR(20)
);
```

## API Compatibility Strategies

### 1. Maintaining Response Shapes

#### MongoDB Response
```javascript
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "headOffices": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Mumbai Office"
    }
  ],
  "bankDetails": {
    "bankName": "HDFC Bank",
    "accountNo": "123456789"
  }
}
```

#### PostgreSQL Query to Match Response
```sql
-- Query with JSON aggregation
SELECT 
    u.id as "_id",
    u.name,
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                '_id', ho.id,
                'name', ho.name
            )
        ) FILTER (WHERE ho.id IS NOT NULL), 
        '[]'::json
    ) as "headOffices",
    u.bank_details as "bankDetails"
FROM users u
LEFT JOIN user_head_offices uho ON u.id = uho.user_id
LEFT JOIN head_offices ho ON uho.head_office_id = ho.id
WHERE u.id = $1
GROUP BY u.id, u.name, u.bank_details;
```

### 2. Handling Nested Queries

#### MongoDB Aggregation Pipeline
```javascript
db.users.aggregate([
  {
    $lookup: {
      from: "attendance",
      localField: "_id",
      foreignField: "userId",
      as: "attendanceRecords"
    }
  },
  {
    $project: {
      name: 1,
      totalWorkingHours: {
        $sum: "$attendanceRecords.totalWorkingMinutes"
      }
    }
  }
]);
```

#### Equivalent PostgreSQL Query
```sql
SELECT 
    u.name,
    COALESCE(SUM(a.total_working_minutes), 0) as "totalWorkingHours"
FROM users u
LEFT JOIN attendance a ON u.id = a.user_id
GROUP BY u.id, u.name;
```

## Migration Scripts

### 1. User Migration Script
```javascript
async function migrateUsers() {
    const mongoUsers = await db.collection('users').find({}).toArray();
    const idMapping = new Map();
    
    for (const user of mongoUsers) {
        const newId = uuidv4();
        idMapping.set(user._id.toString(), newId);
        
        await pgClient.query(`
            INSERT INTO users (
                id, employee_code, name, email, password_hash,
                mobile_number, gender, role, salary_amount,
                bank_details, legal_documents, emergency_contact,
                is_active, email_verified, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
            newId,
            user.employeeCode,
            user.name,
            user.email,
            user.password,
            user.mobileNumber,
            user.gender,
            user.role,
            user.salaryAmount,
            JSON.stringify(user.bankDetails || {}),
            JSON.stringify(user.legalDocuments || {}),
            JSON.stringify(user.emergencyContact || {}),
            user.isActive !== false,
            user.emailVerified || false,
            user.createdAt || new Date(),
            user.updatedAt || new Date()
        ]);
        
        // Migrate head offices relationship
        if (user.headOffices && user.headOffices.length > 0) {
            for (const headOfficeId of user.headOffices) {
                const mappedHeadOfficeId = idMapping.get(headOfficeId.toString());
                if (mappedHeadOfficeId) {
                    await pgClient.query(`
                        INSERT INTO user_head_offices (user_id, head_office_id)
                        VALUES ($1, $2)
                    `, [newId, mappedHeadOfficeId]);
                }
            }
        }
    }
    
    return idMapping;
}
```

### 2. Attendance Migration Script
```javascript
async function migrateAttendance(userIdMapping) {
    const mongoAttendance = await db.collection('attendances').find({}).toArray();
    
    for (const attendance of mongoAttendance) {
        const newUserId = userIdMapping.get(attendance.userId.toString());
        if (!newUserId) continue;
        
        await pgClient.query(`
            INSERT INTO attendance (
                id, user_id, date, punch_sessions, current_session,
                auto_breaks, total_working_minutes, total_break_minutes,
                status, is_late, late_by_minutes, first_punch_in,
                last_punch_out, overtime_minutes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
            uuidv4(),
            newUserId,
            attendance.date,
            JSON.stringify(attendance.punchSessions || []),
            attendance.currentSession || -1,
            JSON.stringify(attendance.autoBreaks || []),
            attendance.totalWorkingMinutes || 0,
            attendance.totalBreakMinutes || 0,
            attendance.status || 'absent',
            attendance.isLate || false,
            attendance.lateByMinutes || 0,
            attendance.firstPunchIn,
            attendance.lastPunchOut,
            attendance.overtimeMinutes || 0,
            attendance.createdAt || new Date(),
            attendance.updatedAt || new Date()
        ]);
    }
}
```

## Performance Considerations

### 1. Indexing Strategy
```sql
-- Critical indexes for performance
CREATE INDEX CONCURRENTLY idx_users_employee_code ON users(employee_code);
CREATE INDEX CONCURRENTLY idx_attendance_user_date ON attendance(user_id, date DESC);
CREATE INDEX CONCURRENTLY idx_locations_user_timestamp ON locations(user_id, timestamp DESC);

-- JSONB indexes for nested queries
CREATE INDEX CONCURRENTLY idx_users_bank_details_gin ON users USING GIN(bank_details);
CREATE INDEX CONCURRENTLY idx_attendance_punch_sessions_gin ON attendance USING GIN(punch_sessions);
```

### 2. Query Optimization
```sql
-- Use materialized views for complex aggregations
CREATE MATERIALIZED VIEW user_attendance_summary AS
SELECT 
    u.id as user_id,
    u.name,
    COUNT(a.id) as total_days,
    SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days,
    AVG(a.total_working_minutes) as avg_working_minutes
FROM users u
LEFT JOIN attendance a ON u.id = a.user_id
WHERE a.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id, u.name;

-- Refresh periodically
CREATE INDEX ON user_attendance_summary(user_id);
```

## Trade-offs and Decisions

### 1. JSONB vs Normalization

#### Use JSONB When:
- ✅ Schema is flexible/dynamic (bankDetails, legalDocuments)
- ✅ Nested structure is queried as a whole
- ✅ Frequent schema changes expected
- ✅ Complex nested objects (punchSessions, coordinates)

#### Use Normalization When:
- ✅ Need to query/filter on nested fields frequently
- ✅ Referential integrity is critical
- ✅ Better performance for joins
- ✅ Clear relational structure (visit_history → doctor_visit_history)

### 2. Array Handling

#### PostgreSQL Arrays:
```sql
-- Good for simple, homogeneous data
work_days TEXT[] -- ['Monday', 'Tuesday']
applicable_roles TEXT[] -- ['Admin', 'Manager']
```

#### Separate Tables:
```sql
-- Better for complex objects with relationships
CREATE TABLE user_head_offices (
    user_id UUID REFERENCES users(id),
    head_office_id UUID REFERENCES head_offices(id)
);
```

### 3. ID Strategy

#### Option A: Generate New UUIDs
- ✅ Clean, PostgreSQL-native approach
- ✅ Better performance
- ❌ Requires complete ID mapping during migration
- ❌ Breaks external references

#### Option B: Convert ObjectIds to UUIDs
- ✅ Preserves some relationship to original IDs
- ✅ Easier migration
- ❌ Non-standard UUID format
- ❌ Potential compatibility issues

**Recommendation**: Use Option A (new UUIDs) for better long-term maintainability.

## Testing Strategy

### 1. Data Integrity Validation
```javascript
// Validate record counts
const mongoCount = await db.collection('users').countDocuments();
const pgCount = await pgClient.query('SELECT COUNT(*) FROM users');
console.assert(mongoCount === parseInt(pgCount.rows[0].count));

// Validate sample data
const mongoSample = await db.collection('users').findOne({});
const pgSample = await pgClient.query('SELECT * FROM users LIMIT 1');
// Compare critical fields...
```

### 2. API Response Validation
```javascript
// Test API compatibility
const mongoResponse = await mongoAPI.getUser(userId);
const pgResponse = await pgAPI.getUser(userId);

// Deep compare response structures
expect(pgResponse).toMatchObject(mongoResponse);
```

## Rollback Strategy

### 1. Parallel Running
- Keep MongoDB running during initial PostgreSQL deployment
- Use feature flags to switch between databases
- Monitor performance and data consistency

### 2. Data Synchronization
```javascript
// Sync critical changes back to MongoDB during transition
async function syncToMongo(pgChange) {
    if (pgChange.table === 'users') {
        await db.collection('users').updateOne(
            { _id: ObjectId(pgChange.oldId) },
            { $set: pgChange.data }
        );
    }
}
```

## Deployment Checklist

- [ ] PostgreSQL server setup and configuration
- [ ] Database schema creation (`database.sql`)
- [ ] Index creation for performance
- [ ] Migration scripts tested on sample data
- [ ] API layer updated for PostgreSQL
- [ ] Response format compatibility verified
- [ ] Performance benchmarks established
- [ ] Monitoring and alerting configured
- [ ] Rollback procedures documented
- [ ] Team training completed

## Conclusion

This migration strategy provides a comprehensive approach to converting the GlucksCare ERP system from MongoDB to PostgreSQL while maintaining API compatibility and ensuring data integrity. The use of JSONB for flexible schemas and proper normalization for relational data provides the best of both worlds.

Key benefits of this approach:
- **Data Integrity**: Strong typing and constraints
- **Performance**: Optimized indexes and query patterns
- **Flexibility**: JSONB for dynamic schemas
- **Compatibility**: Maintained API response shapes
- **Scalability**: Proper normalization and indexing strategy