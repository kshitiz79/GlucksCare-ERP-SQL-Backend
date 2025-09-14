# Entity Relationship Diagram (ERD) Summary

## GlucksCare ERP - PostgreSQL Database Schema

### Core Entity Groups

#### 1. 🏢 **Organizational Structure**
```
States (1:M) HeadOffices (1:M) Users
       ↓
   Branches, Departments, Designations, EmploymentTypes
```

**Key Tables:**
- `states` - Geographic regions
- `head_offices` - Company locations
- `branches` - Office branches
- `departments` - Organizational departments
- `designations` - Job titles/positions
- `employment_types` - Employment categories

#### 2. 👥 **User Management & Hierarchy**
```
Users (Self-referencing hierarchy)
  ├── UserManagers (M:M) - Reporting structure
  ├── UserHeadOffices (M:M) - Multi-office assignments
  └── UserShifts (M:M) - Shift assignments
```

**Key Tables:**
- `users` - Main employee/user table
- `user_managers` - Hierarchical relationships
- `user_head_offices` - Multi-office assignments
- `user_shifts` - Shift assignments

#### 3. ⏰ **Time & Attendance Management**
```
Shifts (1:M) Attendance (M:1) Users
  ├── PayrollSettings (1:1) - Shift-specific payroll rules
  └── Attendance.punch_sessions (JSONB) - Multiple daily sessions
```

**Key Tables:**
- `shifts` - Work shift definitions
- `attendance` - Daily attendance records
- `payroll_settings` - Payroll calculation rules

#### 4. 🏖️ **Leave Management**
```
LeaveTypes (1:M) Leaves (M:1) Users
Holidays (M:M) States - Holiday applicability
```

**Key Tables:**
- `leave_types` - Types of leave (sick, vacation, etc.)
- `leaves` - Leave applications with approval workflow
- `holidays` - Company and regional holidays

#### 5. 🏥 **Business Entities (CRM)**
```
HeadOffices (1:M) ┌─ Doctors
                  ├─ Chemists  
                  └─ Stockists
```

**Key Tables:**
- `doctors` - Healthcare professionals
- `chemists` - Pharmacy contacts
- `stockists` - Distribution partners
- `doctor_visit_history` - Historical visit records
- `chemist_annual_turnover` - Financial data
- `stockist_annual_turnover` - Financial data

#### 6. 🚗 **Visit Management**
```
Users (1:M) ┌─ DoctorVisits (M:1) Doctors
            ├─ ChemistVisits (M:1) Chemists
            ├─ StockistVisits (M:1) Stockists
            └─ Visits (Comprehensive visit records)
```

**Key Tables:**
- `doctor_visits` - Doctor visit records
- `chemist_visits` - Chemist visit records  
- `stockist_visits` - Stockist visit records
- `visits` - Detailed visit reports
- `visit_products_*` - Product promotion tracking

#### 7. 📍 **Location Tracking**
```
Users (1:M) ┌─ Locations (Basic GPS tracking)
            ├─ LocationHistory (Optimized paths)
            ├─ StopEvents (Significant stops)
            ├─ RealTimeLocations (1:1) (Current position)
            ├─ LocationEvents (Processing queue)
            └─ HighFrequencyTracks (Detailed tracking)
```

**Key Tables:**
- `locations` - Basic GPS coordinates
- `location_history` - Compressed location paths
- `stop_events` - Detected stops/breaks
- `real_time_locations` - Current user positions
- `location_events` - Processing queue for GPS data
- `high_frequency_tracks` - Detailed tracking sessions

#### 8. 💰 **Sales & Financial**
```
Users (1:M) ┌─ SalesActivities
            ├─ SalesTargets
            ├─ Orders
            └─ Expenses
            
Products (M:M) Visits - Product promotion tracking
```

**Key Tables:**
- `products` - Company products/medicines
- `sales_activities` - Sales call records
- `sales_targets` - Monthly/yearly targets
- `orders` - Product orders
- `expenses` - Expense claims
- `expense_settings` - Expense calculation rules

#### 9. 📱 **Communication & System**
```
Users (1:M) ┌─ Notifications (1:M) NotificationRecipients
            ├─ Tickets (Support requests)
            └─ Versions (1:1) (App version tracking)
            
PdfFiles - Document management
```

**Key Tables:**
- `notifications` - System notifications
- `notification_recipients` - Notification delivery tracking
- `tickets` - Support ticket system
- `versions` - Mobile app version management
- `pdf_files` - Document storage references

## Relationship Types

### One-to-Many (1:M)
- `users` → `attendance` (One user has many attendance records)
- `head_offices` → `doctors` (One office manages many doctors)
- `leave_types` → `leaves` (One leave type used in many applications)

### Many-to-Many (M:M)
- `users` ↔ `head_offices` (via `user_head_offices`)
- `users` ↔ `shifts` (via `user_shifts`)
- `visits` ↔ `products` (via `visit_products_*`)

### One-to-One (1:1)
- `users` ↔ `real_time_locations` (Current location per user)
- `users` ↔ `versions` (App version per user)
- `shifts` ↔ `payroll_settings` (Payroll rules per shift)

### Self-Referencing
- `users` → `users` (via `user_managers` - hierarchical reporting)

## Key Design Decisions

### 1. **JSONB Usage** 🗂️
Used for flexible/dynamic data structures:
- `users.bank_details` - Banking information
- `users.legal_documents` - Document URLs
- `attendance.punch_sessions` - Multiple daily punch records
- `location_history.coordinates` - GPS coordinate arrays
- `leaves.approval_flow` - Dynamic approval workflow

### 2. **Array Fields** 📋
PostgreSQL arrays for simple lists:
- `shifts.work_days` - Days of the week
- `holidays.applicable_roles` - Role-based holiday applicability
- `stockists.areas_of_operation` - Geographic coverage

### 3. **Normalization Strategy** 🔄
- **Highly Normalized**: Core business entities (users, doctors, visits)
- **Partially Normalized**: Complex nested data preserved in JSONB
- **Denormalized**: Frequently accessed data (user_name stored with records)

### 4. **UUID Primary Keys** 🔑
- All tables use UUID primary keys for better distribution
- Foreign key relationships maintained with UUIDs
- Enables easy horizontal scaling

### 5. **Audit Trail** 📝
Comprehensive audit fields:
- `created_at`, `updated_at` - Timestamp tracking
- `created_by`, `updated_by` - User action tracking
- Triggers for automatic timestamp updates

## Performance Optimizations

### 1. **Strategic Indexing** ⚡
```sql
-- User lookups
CREATE INDEX idx_users_employee_code ON users(employee_code);
CREATE INDEX idx_users_email ON users(email);

-- Time-series data
CREATE INDEX idx_attendance_user_date ON attendance(user_id, date DESC);
CREATE INDEX idx_locations_user_timestamp ON locations(user_id, timestamp DESC);

-- JSONB queries
CREATE INDEX idx_users_bank_details_gin ON users USING GIN(bank_details);
CREATE INDEX idx_attendance_punch_sessions_gin ON attendance USING GIN(punch_sessions);
```

### 2. **Materialized Views** 📊
For complex aggregations:
- User attendance summaries
- Leave balance calculations
- Sales performance metrics

### 3. **Partitioning Strategy** 📅
Recommended for large tables:
- `attendance` - Partition by month
- `locations` - Partition by date
- `location_history` - Partition by date range

## Data Integrity Features

### 1. **Constraints** 🛡️
- `CHECK` constraints for enum values
- `UNIQUE` constraints for business rules
- `NOT NULL` constraints for required fields
- Foreign key constraints for referential integrity

### 2. **Triggers** ⚙️
- Automatic `updated_at` timestamp updates
- Data validation triggers
- Audit trail maintenance

### 3. **Views** 👁️
Simplified data access:
- `user_summary` - User information with joins
- `attendance_summary` - Attendance with calculated fields
- `leave_balance` - Current leave balances

## Migration Complexity Matrix

| Entity Group | Complexity | Strategy | Notes |
|--------------|------------|----------|-------|
| Users | **High** | Normalize + JSONB | Complex hierarchy and flexible fields |
| Attendance | **High** | JSONB Arrays | Multiple punch sessions per day |
| Locations | **Medium** | Multiple Tables | Different tracking granularities |
| Business Entities | **Medium** | Normalize | Clear relational structure |
| Visits | **Medium** | Normalize + M:M | Product relationships |
| Leaves | **Low** | Normalize | Standard workflow structure |
| System Tables | **Low** | Direct Migration | Simple structures |

## API Compatibility Strategy

### Response Shape Preservation
The schema is designed to maintain MongoDB-like API responses through:

1. **JSON Aggregation Functions**
   ```sql
   SELECT 
       u.id as "_id",
       u.name,
       JSON_AGG(ho.*) as "headOffices"
   FROM users u
   LEFT JOIN user_head_offices uho ON u.id = uho.user_id
   LEFT JOIN head_offices ho ON uho.head_office_id = ho.id
   GROUP BY u.id, u.name;
   ```

2. **JSONB Field Access**
   ```sql
   SELECT 
       u.bank_details as "bankDetails",
       u.legal_documents as "legalDocuments"
   FROM users u;
   ```

3. **Computed Fields**
   ```sql
   SELECT 
       a.*,
       ROUND(a.total_working_minutes / 60.0, 2) as "workingHours"
   FROM attendance a;
   ```

## Scalability Considerations

### Horizontal Scaling
- UUID primary keys enable easy sharding
- Stateless design supports multiple application instances
- Read replicas for reporting queries

### Vertical Scaling
- Optimized indexes for query performance
- JSONB for flexible schema evolution
- Materialized views for complex aggregations

### Caching Strategy
- Redis for session management
- Application-level caching for frequently accessed data
- Database query result caching

This ERD represents a well-normalized, performant, and scalable PostgreSQL schema that maintains compatibility with the existing MongoDB-based API while providing the benefits of a relational database system.