# Device Binding - Quick Reference Card

## 🔐 Login Request Format

### Mobile App (with Device Binding)
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "androidId": "abc123def456",
  "manufacturer": "Samsung",
  "model": "Galaxy Tab A8"
}
```

### Legacy (backward compatible)
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "device_id": "legacy-device-id"
}
```

---

## 📱 Get Device Info (React Native)

```javascript
import DeviceInfo from 'react-native-device-info';

const deviceInfo = {
  androidId: await DeviceInfo.getAndroidId(),
  manufacturer: await DeviceInfo.getManufacturer(),
  model: await DeviceInfo.getModel()
};
```

---

## ⚠️ Error Responses

### Device Mismatch (403)
```json
{
  "success": false,
  "msg": "Device already registered",
  "deviceMismatch": true,
  "registeredDevice": {
    "name": "Samsung Galaxy Tab A8",
    "lastLogin": "2026-01-02T10:30:00Z"
  }
}
```

### Device In Use (403)
```json
{
  "success": false,
  "msg": "Device already registered to another user",
  "deviceInUse": true
}
```

---

## 🔧 Admin API Endpoints

### Reset Device Binding
```bash
POST /api/user-devices/reset/:userId
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "Device replacement"
}
```

### View User Devices
```bash
GET /api/user-devices/user/:userId
Authorization: Bearer <admin-token>
```

### View All Devices
```bash
GET /api/user-devices/all?status=ACTIVE&page=1&limit=50
Authorization: Bearer <admin-token>
```

### Revoke Device
```bash
POST /api/user-devices/revoke/:deviceId
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "Security concern"
}
```

---

## 🔍 Testing

### Test Utilities
```bash
node test-device-fingerprinting.js
```

### Test Login (cURL)
```bash
curl -X POST http://localhost:5051/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password",
    "androidId": "test123",
    "manufacturer": "Samsung",
    "model": "Galaxy Tab"
  }'
```

---

## 📊 Database Queries

### Active Devices Count
```sql
SELECT COUNT(*) FROM user_devices WHERE status = 'ACTIVE';
```

### Users Without Devices
```sql
SELECT u.name, u.email
FROM users u
LEFT JOIN user_devices ud ON u.id = ud.user_id AND ud.status = 'ACTIVE'
WHERE ud.id IS NULL AND u.is_active = true;
```

### Recent Device Bindings
```sql
SELECT ud.device_name, u.name, ud.created_at
FROM user_devices ud
JOIN users u ON ud.user_id = u.id
WHERE ud.status = 'ACTIVE'
ORDER BY ud.created_at DESC
LIMIT 10;
```

---

## 🚨 Common Issues

| Issue | Solution |
|-------|----------|
| User can't login after factory reset | Admin resets device binding |
| "Device already registered" error | Verify user, then reset if legitimate |
| Multiple users, one device | Each user needs their own device |
| App update breaks login | Should work fine (ANDROID_ID stable) |

---

## 📚 Documentation

- **Technical Docs:** `DEVICE_BINDING_README.md`
- **Admin Guide:** `ADMIN_DEVICE_BINDING_GUIDE.md`
- **Migration:** `migrations/DEVICE_FINGERPRINTING_MIGRATION.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`

---

## 🎯 Key Points

✅ One user = one device (enforced)  
✅ Device fingerprint = SHA256(androidId + manufacturer + model)  
✅ Factory reset requires admin reset  
✅ App updates don't affect binding  
✅ Full audit trail for admin actions  

---

**Version:** 1.0.0 | **Updated:** 2026-01-02
