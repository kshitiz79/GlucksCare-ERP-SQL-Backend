# Device Fingerprinting Migration

**Date:** 2026-01-02  
**Feature:** One User = One Device Enforcement

## Overview
This migration adds device fingerprinting capabilities to enforce strict device binding for users. Each user can only login from one registered device.

## Database Changes

### Table: `user_devices`

#### New Columns Added:

1. **android_id** (VARCHAR 255)
   - Android ANDROID_ID from the device
   - Constant across app updates
   - Changes only on factory reset or different Android user profile

2. **manufacturer** (VARCHAR 255)
   - Device manufacturer (e.g., Samsung, Xiaomi)
   - Constant for the physical device

3. **model** (VARCHAR 255)
   - Device model (e.g., Galaxy Tab A8)
   - Constant for the physical device

4. **device_fingerprint** (VARCHAR 255, UNIQUE)
   - SHA-256 hash of: `android_id + manufacturer + model`
   - Used for device verification
   - Unique constraint ensures one device per fingerprint

5. **status** (VARCHAR 20, DEFAULT 'ACTIVE')
   - Values: 'ACTIVE', 'PENDING', 'REVOKED'
   - Tracks device binding status

6. **revoked_by** (UUID, FK to users.id)
   - Admin who revoked the device binding
   - NULL if not revoked

7. **revoked_at** (TIMESTAMP)
   - When the device was revoked
   - NULL if not revoked

8. **revoke_reason** (TEXT)
   - Reason for device revocation
   - NULL if not revoked

#### Indexes Created:
- `idx_user_devices_fingerprint` on `device_fingerprint`
- `idx_user_devices_status` on `status`
- `idx_user_devices_user_status` on `(user_id, status)`

## SQL Migration Script

```sql
-- Add device fingerprint components

```

## How to Apply

### Option 1: Using Sequelize Auto-Sync (Development)
The server will automatically create these columns when it starts if `sequelize.sync({ alter: true })` is enabled.

### Option 2: Manual Migration (Production)
Run the SQL script above directly on your PostgreSQL database:

```bash
psql -U your_username -d gluckscare_erp_production -f migration_script.sql
```

### Option 3: Using Node.js Script
```javascript
const { sequelize } = require('./src/config/database');

async function migrate() {
  await sequelize.sync({ alter: true });
  console.log('Migration completed');
}

migrate();
```

## Testing the Migration

After applying the migration, verify the columns exist:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_devices'
ORDER BY ordinal_position;
```

## Rollback (if needed)

```sql
-- Remove new columns
ALTER TABLE user_devices 
DROP COLUMN IF EXISTS android_id,
DROP COLUMN IF EXISTS manufacturer,
DROP COLUMN IF EXISTS model,
DROP COLUMN IF EXISTS device_fingerprint,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS revoked_by,
DROP COLUMN IF EXISTS revoked_at,
DROP COLUMN IF EXISTS revoke_reason;

-- Drop indexes
DROP INDEX IF EXISTS idx_user_devices_fingerprint;
DROP INDEX IF EXISTS idx_user_devices_status;
DROP INDEX IF EXISTS idx_user_devices_user_status;
```

## Impact

- **Existing Users:** Will need to bind their device on next login
- **New Users:** Will bind device automatically on first login
- **Admin Users:** Can reset device bindings via `/api/user-devices/reset/:userId`
- **Backward Compatibility:** Legacy `device_id` field is maintained for compatibility

## API Endpoints

### User Endpoints
- `GET /api/user-devices/my-devices` - View my registered devices

### Admin Endpoints
- `GET /api/user-devices/all` - View all devices (paginated)
- `GET /api/user-devices/user/:userId` - View devices for specific user
- `POST /api/user-devices/reset/:userId` - Reset device binding for user
- `POST /api/user-devices/revoke/:deviceId` - Revoke specific device

## Login Flow Changes

### Mobile App Requirements
The mobile app must now send these additional fields during login:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "androidId": "abc123def456",
  "manufacturer": "Samsung",
  "model": "Galaxy Tab A8"
}
```

### Response on Device Mismatch
```json
{
  "success": false,
  "msg": "Device already registered",
  "error": "This account is already registered to another device...",
  "deviceMismatch": true,
  "registeredDevice": {
    "name": "Samsung Galaxy Tab A8",
    "lastLogin": "2026-01-02T10:30:00Z"
  }
}
```
