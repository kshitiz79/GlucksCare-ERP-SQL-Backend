# Doctor Priority Field - API Documentation

## Overview
The `priority` field allows classification of doctors into three categories:
- **A** - High Priority (VIP doctors, key opinion leaders)
- **B** - Medium Priority (Important doctors)
- **C** - Normal Priority (Default for all doctors)

## Database Schema

### Field Details
```sql
Column: priority
Type: VARCHAR(1)
Nullable: NO
Default: 'C'
Constraint: CHECK (priority IN ('A', 'B', 'C'))
Index: idx_doctors_priority
```

### Migration Applied ✅
```sql
-- Add priority column
ALTER TABLE doctors 
ADD COLUMN IF NOT EXISTS priority VARCHAR(1) 
DEFAULT 'C' 
CHECK (priority IN ('A', 'B', 'C'));

-- Update existing records
UPDATE doctors SET priority = 'C' WHERE priority IS NULL;

-- Make NOT NULL
ALTER TABLE doctors ALTER COLUMN priority SET NOT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_doctors_priority ON doctors(priority);
```

## API Endpoints

### Base URL
```
http://localhost:5051/api/doctors
```

### Authentication
All endpoints require authentication token:
```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Create Doctor (with Priority)

### Endpoint
```
POST /api/doctors
```

### Request Body
```json
{
  "name": "Dr. Rajesh Kumar",
  "specialization": "Cardiologist",
  "location": "Mumbai, Maharashtra",
  "email": "dr.rajesh@example.com",
  "phone": "+91-9876543210",
  "registration_number": "MH12345",
  "years_of_experience": 15,
  "priority": "A",
  "headOfficeId": "uuid-of-head-office"
}
```

### cURL Example
```bash
curl -X POST http://localhost:5051/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Dr. Rajesh Kumar",
    "specialization": "Cardiologist",
    "location": "Mumbai, Maharashtra",
    "email": "dr.rajesh@example.com",
    "phone": "+91-9876543210",
    "registration_number": "MH12345",
    "years_of_experience": 15,
    "priority": "A",
    "headOfficeId": "uuid-of-head-office"
  }'
```

### Response
```json
{
  "success": true,
  "msg": "Doctor created successfully",
  "data": {
    "id": "doctor-uuid",
    "name": "Dr. Rajesh Kumar",
    "specialization": "Cardiologist",
    "priority": "A",
    "created_at": "2026-01-02T08:00:00Z"
  }
}
```

---

## 2. Update Doctor Priority

### Endpoint
```
PUT /api/doctors/:id
```

### Request Body
```json
{
  "priority": "B"
}
```

### cURL Example
```bash
curl -X PUT http://localhost:5051/api/doctors/DOCTOR_UUID_HERE \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "priority": "B"
  }'
```

### Response
```json
{
  "success": true,
  "msg": "Doctor updated successfully",
  "data": {
    "id": "doctor-uuid",
    "name": "Dr. Rajesh Kumar",
    "priority": "B",
    "updated_at": "2026-01-02T08:30:00Z"
  }
}
```

---

## 3. Get All Doctors (with Priority Filter)

### Endpoint
```
GET /api/doctors?priority=A
```

### Query Parameters
- `priority` (optional): Filter by priority (A, B, or C)
- `page` (optional): Page number for pagination
- `limit` (optional): Items per page

### cURL Examples

**Get all A-priority doctors:**
```bash
curl -X GET "http://localhost:5051/api/doctors?priority=A" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Get all B-priority doctors:**
```bash
curl -X GET "http://localhost:5051/api/doctors?priority=B" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Get all doctors (no filter):**
```bash
curl -X GET "http://localhost:5051/api/doctors" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "doctor-uuid-1",
      "name": "Dr. Rajesh Kumar",
      "specialization": "Cardiologist",
      "priority": "A",
      "location": "Mumbai"
    },
    {
      "id": "doctor-uuid-2",
      "name": "Dr. Priya Sharma",
      "specialization": "Neurologist",
      "priority": "A",
      "location": "Delhi"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 50
  }
}
```

---

## 4. Get Doctor by ID

### Endpoint
```
GET /api/doctors/:id
```

### cURL Example
```bash
curl -X GET http://localhost:5051/api/doctors/DOCTOR_UUID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Response
```json
{
  "success": true,
  "data": {
    "id": "doctor-uuid",
    "name": "Dr. Rajesh Kumar",
    "specialization": "Cardiologist",
    "priority": "A",
    "email": "dr.rajesh@example.com",
    "phone": "+91-9876543210",
    "registration_number": "MH12345",
    "years_of_experience": 15,
    "location": "Mumbai, Maharashtra",
    "created_at": "2026-01-02T08:00:00Z",
    "updated_at": "2026-01-02T08:30:00Z"
  }
}
```

---

## 5. Bulk Create Doctors (with Priority)

### Endpoint
```
POST /api/doctors/bulk
```

### Request Body
```json
{
  "doctors": [
    {
      "name": "Dr. Amit Patel",
      "specialization": "Orthopedic",
      "priority": "A",
      "headOfficeId": "uuid-here"
    },
    {
      "name": "Dr. Sneha Reddy",
      "specialization": "Pediatrician",
      "priority": "B",
      "headOfficeId": "uuid-here"
    },
    {
      "name": "Dr. Vikram Singh",
      "specialization": "General Physician",
      "priority": "C",
      "headOfficeId": "uuid-here"
    }
  ]
}
```

### cURL Example
```bash
curl -X POST http://localhost:5051/api/doctors/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "doctors": [
      {
        "name": "Dr. Amit Patel",
        "specialization": "Orthopedic",
        "priority": "A",
        "headOfficeId": "uuid-here"
      },
      {
        "name": "Dr. Sneha Reddy",
        "specialization": "Pediatrician",
        "priority": "B",
        "headOfficeId": "uuid-here"
      }
    ]
  }'
```

---

## 6. Get My Doctors (Current User's Head Office)

### Endpoint
```
GET /api/doctors/my-doctors
```

### cURL Example
```bash
curl -X GET http://localhost:5051/api/doctors/my-doctors \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Priority Classification Guide

### A - High Priority
**Use for:**
- Key Opinion Leaders (KOLs)
- High-volume prescribers
- VIP doctors
- Doctors with significant influence

**Characteristics:**
- Require frequent visits
- Special attention needed
- High business potential
- Strategic importance

### B - Medium Priority
**Use for:**
- Important doctors
- Regular prescribers
- Growing potential
- Established relationship

**Characteristics:**
- Regular visit schedule
- Good business potential
- Moderate influence
- Consistent engagement

### C - Normal Priority
**Use for:**
- Standard doctors
- New doctors
- Low-volume prescribers
- General practitioners

**Characteristics:**
- Standard visit frequency
- Normal business potential
- Default classification
- Routine engagement

---

## Validation Rules

### Priority Field
- **Required:** No (defaults to 'C' if not provided)
- **Allowed Values:** 'A', 'B', 'C' (case-insensitive)
- **Case Handling:** Automatically converted to uppercase
- **Invalid Values:** Returns 400 error

### Error Response (Invalid Priority)
```json
{
  "success": false,
  "msg": "Invalid priority value. Must be A, B, or C",
  "error": "Validation error"
}
```

---

## Database Queries

### Get Priority Distribution
```sql
SELECT 
    priority,
    COUNT(*) as doctor_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM doctors
GROUP BY priority
ORDER BY priority;
```

### Get High Priority Doctors
```sql
SELECT id, name, specialization, location, priority
FROM doctors
WHERE priority = 'A'
ORDER BY name;
```

### Update Multiple Doctors to Priority A
```sql
UPDATE doctors
SET priority = 'A'
WHERE id IN ('uuid1', 'uuid2', 'uuid3');
```

---

## Testing

### Test Priority Creation
```bash
# Create A-priority doctor
curl -X POST http://localhost:5051/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Doctor A","priority":"A","headOfficeId":"uuid"}'

# Create B-priority doctor
curl -X POST http://localhost:5051/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Doctor B","priority":"B","headOfficeId":"uuid"}'

# Create C-priority doctor (default)
curl -X POST http://localhost:5051/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Doctor C","headOfficeId":"uuid"}'
```

### Test Priority Update
```bash
# Update to A priority
curl -X PUT http://localhost:5051/api/doctors/DOCTOR_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"priority":"A"}'
```

### Test Priority Filter
```bash
# Get all A-priority doctors
curl -X GET "http://localhost:5051/api/doctors?priority=A" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Frontend Integration

### React Example
```javascript
// Create doctor with priority
const createDoctor = async (doctorData) => {
  const response = await axios.post('/api/doctors', {
    ...doctorData,
    priority: 'A'  // or 'B', 'C'
  }, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};

// Update doctor priority
const updatePriority = async (doctorId, newPriority) => {
  const response = await axios.put(`/api/doctors/${doctorId}`, {
    priority: newPriority
  }, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};

// Get doctors by priority
const getDoctorsByPriority = async (priority) => {
  const response = await axios.get('/api/doctors', {
    params: { priority },
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data;
};
```

---

## Status

✅ **Database Migration:** Completed  
✅ **Model Updated:** Doctor.js  
✅ **Controller Updated:** doctorController.js  
✅ **API Endpoints:** Working  
✅ **Validation:** Implemented  
✅ **Index Created:** For performance  

**Last Updated:** 2026-01-02  
**Version:** 1.0.0
