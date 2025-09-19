# API Endpoints Test Guide

## Backend Connection Status

### ✅ Connected Modules:
1. **Shift Management** - `/api/shifts`
2. **Attendance Management** - `/api/attendance` 
3. **Leave Management** - `/api/leaves`
4. **Leave Type Management** - `/api/leave-types` ✨ (Newly Connected)

## Test Endpoints

### 1. Shift Management
```bash
# Get all shifts
GET http://localhost:5051/api/shifts

# Create new shift
POST http://localhost:5051/api/shifts
{
  "name": "Morning Shift",
  "description": "Standard morning working hours",
  "start_time": "09:00:00",
  "end_time": "17:00:00",
  "work_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  "break_duration": 60,
  "is_active": true
}

# Get users for shift assignment
GET http://localhost:5051/api/shifts/users/for-shift-assignment?search=

# Assign users to shift
POST http://localhost:5051/api/shifts/{shiftId}/assign-users
{
  "userIds": ["user-id-1", "user-id-2"]
}
```

### 2. Attendance Management
```bash
# Get today's attendance for admin
GET http://localhost:5051/api/attendance/admin/today

# Get today's attendance for specific user
GET http://localhost:5051/api/attendance/today/{userId}

# Toggle punch in/out
POST http://localhost:5051/api/attendance/toggle-punch
{
  "userId": "user-id"
}
```

### 3. Leave Type Management
```bash
# Get all leave types
GET http://localhost:5051/api/leave-types

# Get active leave types only
GET http://localhost:5051/api/leave-types?isActive=true

# Create new leave type
POST http://localhost:5051/api/leave-types
{
  "name": "Annual Leave",
  "code": "AL",
  "description": "Yearly vacation leave",
  "maxDaysPerYear": 21,
  "maxConsecutiveDays": 10,
  "carryForward": true,
  "carryForwardLimit": 5,
  "encashable": false,
  "requiresDocuments": false,
  "applicableFor": ["All"],
  "minimumServiceMonths": 6,
  "advanceApplication": 7,
  "color": "#10B981"
}

# Toggle leave type status
POST http://localhost:5051/api/leave-types/{id}/toggle-status
```

### 4. Leave Management
```bash
# Get all leaves (admin)
GET http://localhost:5051/api/leaves

# Get my leaves (user)
GET http://localhost:5051/api/leaves/my-leaves?userId={userId}

# Get leave balance (user)
GET http://localhost:5051/api/leaves/balance?userId={userId}

# Apply for leave
POST http://localhost:5051/api/leaves/apply
{
  "employeeId": "user-id",
  "leaveTypeId": "leave-type-id",
  "startDate": "2024-12-25",
  "endDate": "2024-12-27",
  "reason": "Family vacation",
  "isHalfDay": false,
  "emergencyContact": {
    "name": "John Doe",
    "phone": "+1234567890",
    "relation": "Spouse"
  }
}

# Cancel leave
PUT http://localhost:5051/api/leaves/{id}/cancel
```

## Frontend Integration Points

### Admin Dashboard Pages:
- **Shift Management**: Uses `/api/shifts` endpoints
- **Attendance Overview**: Uses `/api/attendance/admin/today`
- **Attendance Report**: Uses `/api/attendance/admin/today` with filters
- **Leave Management**: Uses `/api/leave-types` and `/api/leaves`

### MR Dashboard Pages:
- **Attendance**: Uses `/api/attendance/today/{userId}` and `/api/attendance/toggle-punch`
- **Leave Application**: Uses `/api/leave-types`, `/api/leaves/apply`, `/api/leaves/balance`
- **My Leaves**: Uses `/api/leaves/my-leaves` and `/api/leaves/{id}/cancel`

## Socket.IO Events

### Real-time Updates:
- **Attendance Updates**: `attendance-update` event sent to `user-{userId}` room
- **Location Tracking**: `user-location-update` event for GPS tracking

## Database Models

### Enhanced Features:
1. **Attendance**: Multiple punch sessions, real-time status tracking
2. **Shifts**: User assignment, work days configuration
3. **Leave Types**: Comprehensive policy management
4. **Leaves**: Approval workflow, half-day support

## Next Steps

1. **Test all endpoints** with Postman or similar tool
2. **Verify database connections** and model associations
3. **Test real-time features** with Socket.IO
4. **Add authentication middleware** for protected routes
5. **Implement proper error handling** and validation