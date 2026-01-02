# Admin Guide: Device Binding Management

## Quick Reference

### Common Admin Tasks

#### 1. Reset Device Binding for a User

**When to use:**
- User got a new tablet
- Device was factory reset
- Device is lost/stolen
- User needs to switch devices

**Steps:**
1. Get the user's ID (from user management)
2. Call the reset endpoint:

```bash
POST /api/user-devices/reset/:userId
Authorization: Bearer <admin-token>

{
  "reason": "Tablet replaced - old device damaged"
}
```

**Example using cURL:**
```bash
curl -X POST https://api.gluckscare.com/api/user-devices/reset/USER_ID_HERE \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Device replacement"}'
```

#### 2. View User's Registered Devices

```bash
GET /api/user-devices/user/:userId
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "device-uuid",
      "device_name": "Samsung Galaxy Tab A8",
      "status": "ACTIVE",
      "last_login": "2026-01-02T10:30:00Z",
      "created_at": "2026-01-01T08:00:00Z"
    }
  ]
}
```

#### 3. View All Devices in System

```bash
GET /api/user-devices/all?status=ACTIVE&page=1&limit=50
Authorization: Bearer <admin-token>
```

**Query Parameters:**
- `status`: Filter by status (ACTIVE, PENDING, REVOKED)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

#### 4. Revoke Specific Device

```bash
POST /api/user-devices/revoke/:deviceId
Authorization: Bearer <admin-token>

{
  "reason": "Security concern - unauthorized access"
}
```

## Troubleshooting

### User Can't Login - "Device Already Registered" Error

**Symptoms:**
- User sees error: "This account is already registered to another device"
- User recently got a new tablet or factory reset their device

**Solution:**
1. Verify the user's identity
2. Reset their device binding using the reset endpoint
3. User can now login from the new device

**Example:**
```bash
# Reset device binding
curl -X POST https://api.gluckscare.com/api/user-devices/reset/abc-123-def \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Factory reset - user verified"}'
```

### User Trying to Login from Multiple Devices

**Symptoms:**
- User reports they can't login from their new device
- User has both old and new tablet

**Solution:**
1. Explain that only one device is allowed per user
2. If they need to switch devices:
   - Reset their device binding
   - They can login from the new device
3. Old device will no longer work

### Checking Device Binding Status

**View user's device:**
```bash
GET /api/user-devices/user/USER_ID
```

**Check specific device:**
```bash
GET /api/user-devices/all?status=ACTIVE
```

Look for the user's entry in the response.

## Security Best Practices

### When to Reset Device Binding

✅ **DO reset when:**
- User provides valid reason (new device, factory reset)
- User's identity is verified
- User reports lost/stolen device
- Device is damaged and replaced

❌ **DON'T reset when:**
- User wants to use multiple devices simultaneously
- Request seems suspicious or unauthorized
- User can't provide valid reason

### Audit Trail

All admin actions are logged:
- Who performed the action (revoked_by)
- When it was performed (revoked_at)
- Why it was performed (revoke_reason)

**View audit trail:**
```sql
SELECT 
  ud.device_name,
  ud.status,
  ud.revoked_at,
  ud.revoke_reason,
  u.name as revoked_by_name
FROM user_devices ud
LEFT JOIN users u ON ud.revoked_by = u.id
WHERE ud.status = 'REVOKED'
ORDER BY ud.revoked_at DESC;
```

## API Endpoints Summary

| Endpoint | Method | Description | Required Role |
|----------|--------|-------------|---------------|
| `/api/user-devices/my-devices` | GET | View my devices | User |
| `/api/user-devices/all` | GET | View all devices | Admin |
| `/api/user-devices/user/:userId` | GET | View user's devices | Admin |
| `/api/user-devices/reset/:userId` | POST | Reset device binding | Admin |
| `/api/user-devices/revoke/:deviceId` | POST | Revoke specific device | Admin |

**Admin Roles:** Super Admin, Admin, Opps Team

## Common Scenarios

### Scenario 1: User Got New Tablet

**User Report:** "I got a new tablet and can't login"

**Admin Action:**
1. Verify user identity
2. Reset device binding:
```bash
POST /api/user-devices/reset/USER_ID
{
  "reason": "New tablet issued - old device returned"
}
```
3. Inform user they can now login

### Scenario 2: Factory Reset

**User Report:** "I factory reset my tablet and now I can't login"

**Admin Action:**
1. Verify user identity
2. Reset device binding:
```bash
POST /api/user-devices/reset/USER_ID
{
  "reason": "Factory reset performed"
}
```
3. User can login again with same device

### Scenario 3: Lost/Stolen Device

**User Report:** "My tablet was stolen"

**Admin Action:**
1. Reset device binding immediately:
```bash
POST /api/user-devices/reset/USER_ID
{
  "reason": "Device reported stolen - security reset"
}
```
2. Issue new device
3. User can login from new device

### Scenario 4: Multiple Users Trying Same Device

**Error:** "This device is already registered to another account"

**Explanation:**
- Each device can only be used by ONE user
- This is by design for accountability
- Each user needs their own device

**Solution:**
- Ensure each user has their own device
- Don't share devices between users

## Monitoring

### Check Active Devices Count

```sql
SELECT COUNT(*) as active_devices
FROM user_devices
WHERE status = 'ACTIVE';
```

### Check Users Without Devices

```sql
SELECT u.id, u.name, u.email
FROM users u
LEFT JOIN user_devices ud ON u.id = ud.user_id AND ud.status = 'ACTIVE'
WHERE ud.id IS NULL
AND u.is_active = true;
```

### Check Recent Device Bindings

```sql
SELECT 
  ud.device_name,
  u.name as user_name,
  ud.created_at
FROM user_devices ud
JOIN users u ON ud.user_id = u.id
WHERE ud.status = 'ACTIVE'
ORDER BY ud.created_at DESC
LIMIT 10;
```

## Support Contacts

For technical issues:
- Backend Team: backend@gluckscare.com
- System Admin: admin@gluckscare.com

For policy questions:
- HR Department: hr@gluckscare.com
- IT Security: security@gluckscare.com

---

**Last Updated:** 2026-01-02  
**Version:** 1.0.0
