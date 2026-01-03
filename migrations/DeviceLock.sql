ALTER TABLE user_devices 
ADD COLUMN IF NOT EXISTS android_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255),
ADD COLUMN IF NOT EXISTS model VARCHAR(255),
ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'REVOKED')),
ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS revoke_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN user_devices.android_id IS 'Android ANDROID_ID - constant across app updates, changes on factory reset';
COMMENT ON COLUMN user_devices.manufacturer IS 'Device manufacturer (e.g., Samsung, Xiaomi)';
COMMENT ON COLUMN user_devices.model IS 'Device model (e.g., Galaxy Tab A8)';
COMMENT ON COLUMN user_devices.device_fingerprint IS 'SHA-256 hash of android_id + manufacturer + model';
COMMENT ON COLUMN user_devices.status IS 'Device binding status: ACTIVE, PENDING, or REVOKED';
COMMENT ON COLUMN user_devices.revoked_by IS 'Admin who revoked this device binding';
COMMENT ON COLUMN user_devices.revoked_at IS 'Timestamp when device was revoked';
COMMENT ON COLUMN user_devices.revoke_reason IS 'Reason for device revocation';

-- Update existing records to have ACTIVE status
UPDATE user_devices 
SET status = 'ACTIVE' 
WHERE status IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_devices_fingerprint ON user_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_devices_status ON user_devices(status);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_status ON user_devices(user_id, status);







ALTER TABLE tickets 
ALTER COLUMN image TYPE TEXT;


**Verification:**

SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'tickets' AND column_name = 'image';




-- Added priority column
ALTER TABLE doctors 
ADD COLUMN priority VARCHAR(1) DEFAULT 'C' 
CHECK (priority IN ('A', 'B', 'C'));

-- Made NOT NULL
ALTER TABLE doctors ALTER COLUMN priority SET NOT NULL;

-- Added index
CREATE INDEX idx_doctors_priority ON doctors(priority);





ALTER TABLE pdf_files 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
-- Step 2: Create Index for faster Join queries (Product Thumbnails के लिए)
CREATE INDEX IF NOT EXISTS idx_pdf_files_product_id ON pdf_files(product_id);
-- Step 3: Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pdf_files' AND column_name = 'product_id';