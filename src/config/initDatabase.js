// src/config/initDatabase.js
// Handles database connection testing, schema verification, and dynamic DDL migrations

async function initializeDatabase(sequelize) {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connection established successfully');

        // Dynamically add tokens_valid_after to users table if not exists
        try {
            await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMP WITH TIME ZONE NULL;');
            console.log('✅ Checked/Added tokens_valid_after column in users table');
        } catch (alterErr) {
            console.warn('⚠️ Warning: Failed to alter users table:', alterErr.message);
        }

        // Dynamically create dcr_settings table if not exists
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS dcr_settings (
                id SERIAL PRIMARY KEY,
                doctor_target INTEGER NOT NULL DEFAULT 10,
                doctor_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
                chemist_target INTEGER NOT NULL DEFAULT 5,
                chemist_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
                stockist_target INTEGER NOT NULL DEFAULT 2,
                stockist_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              )
            `);
            await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS doctor_frequency VARCHAR(20) DEFAULT 'daily';`);
            await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS chemist_frequency VARCHAR(20) DEFAULT 'daily';`);
            await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS stockist_frequency VARCHAR(20) DEFAULT 'daily';`);
            await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS max_visit_distance_meters INTEGER DEFAULT 200;`);
            await sequelize.query(`ALTER TABLE dcr_settings ADD COLUMN IF NOT EXISTS enable_distance_verification BOOLEAN DEFAULT true;`);
            console.log('✅ Checked/Created dcr_settings table with frequency and distance columns');
        } catch (tableErr) {
            console.warn('⚠️ Warning: Failed to create dcr_settings table:', tableErr.message);
        }

        // Dynamically add unique constraints to user_devices to enforce device lock
        try {
            await sequelize.query('ALTER TABLE user_devices ADD CONSTRAINT user_devices_device_id_key UNIQUE (device_id);');
        } catch (constraintErr) {}
        try {
            await sequelize.query('ALTER TABLE user_devices ADD CONSTRAINT user_devices_device_fingerprint_key UNIQUE (device_fingerprint);');
        } catch (constraintErr) {}

        // Dynamically create location_pings table if not exists
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS location_pings (
                id BIGSERIAL PRIMARY KEY,
                client_fix_id VARCHAR(100) UNIQUE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                device_id VARCHAR(100) NOT NULL,
                session_id VARCHAR(100),
                latitude DECIMAL(10, 7) NOT NULL,
                longitude DECIMAL(10, 7) NOT NULL,
                accuracy_m DECIMAL(8, 2),
                speed_mps DECIMAL(8, 2),
                bearing_deg DECIMAL(6, 2),
                provider VARCHAR(50) DEFAULT 'fused',
                is_mock_location BOOLEAN DEFAULT false,
                battery_pct DECIMAL(5, 2),
                network_type VARCHAR(30),
                network_strength INTEGER,
                device_time_utc TIMESTAMP WITH TIME ZONE NOT NULL,
                server_received_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                clock_skew_seconds DECIMAL(10, 2),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
              );
            `);
            console.log('✅ Checked/Created location_pings table');
        } catch (lpErr) {
            console.warn('⚠️ Warning: Failed to create location_pings table:', lpErr.message);
        }

        // Dynamically create offline_bg_tracking table if not exists
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS offline_bg_tracking (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                device_id VARCHAR(255) NOT NULL,
                entity_type VARCHAR(255) NOT NULL,
                entity_id VARCHAR(255) NOT NULL UNIQUE,
                payload JSONB NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                retry_count INTEGER NOT NULL DEFAULT 0,
                created_at_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                last_attempt_utc TIMESTAMP WITH TIME ZONE
              );
            `);
            console.log('✅ Checked/Created offline_bg_tracking table');
        } catch (obtErr) {
            console.warn('⚠️ Warning: Failed to create offline_bg_tracking table:', obtErr.message);
        }

        // Dynamically create company_devices table if not exists
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS company_devices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                company_device_id VARCHAR(255) NOT NULL UNIQUE,
                brand VARCHAR(255) NOT NULL DEFAULT 'Samsung',
                model VARCHAR(255) DEFAULT 'Galaxy Tab A9+',
                imei_1 VARCHAR(255) UNIQUE,
                imei_2 VARCHAR(255),
                serial_number VARCHAR(255),
                android_id VARCHAR(255),
                android_version VARCHAR(255) DEFAULT 'Android 14',
                app_version VARCHAR(255) DEFAULT 'v2.4.1',
                mdm_enrollment_id VARCHAR(255),
                current_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'IN_STOCK',
                assigned_at TIMESTAMP WITH TIME ZONE,
                last_sync_at TIMESTAMP WITH TIME ZONE,
                last_latitude DECIMAL(10, 7),
                last_longitude DECIMAL(10, 7),
                last_address TEXT,
                battery_pct DECIMAL(5, 2),
                is_charging BOOLEAN DEFAULT false,
                network_type VARCHAR(50),
                is_online BOOLEAN DEFAULT false,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `);
            console.log('✅ Checked/Created company_devices table');
        } catch (devErr) {
            console.warn('⚠️ Warning: Failed to create company_devices table:', devErr.message);
        }

        // Dynamically create device_assignment_histories table if not exists
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS device_assignment_histories (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                device_id UUID NOT NULL REFERENCES company_devices(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                unassigned_at TIMESTAMP WITH TIME ZONE,
                action_type VARCHAR(50) NOT NULL DEFAULT 'ASSIGNED',
                reason TEXT,
                assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
                is_current BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `);
            console.log('✅ Checked/Created device_assignment_histories table');
        } catch (histErr) {
            console.warn('⚠️ Warning: Failed to create device_assignment_histories table:', histErr.message);
        }

        // Dynamically add doctor sync columns and change logs table if not exists
        try {
            await sequelize.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS client_generated_id VARCHAR(100);');
        } catch (e) {}
        try {
            await sequelize.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS sync_version BIGINT DEFAULT 1;');
        } catch (e) {}
        try {
            await sequelize.query('CREATE SEQUENCE IF NOT EXISTS doctor_change_version_seq;');
        } catch (e) {}
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS doctor_change_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                doctor_id UUID NOT NULL,
                change_version BIGINT NOT NULL DEFAULT nextval('doctor_change_version_seq'),
                operation VARCHAR(20) NOT NULL,
                head_office_id UUID REFERENCES head_offices(id) ON DELETE SET NULL,
                area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
                snapshot JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `);
            await sequelize.query(`
              CREATE INDEX IF NOT EXISTS idx_doctors_client_gen_id ON doctors (client_generated_id);
              CREATE INDEX IF NOT EXISTS idx_doctors_sync_version ON doctors (sync_version);
              CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_version ON doctor_change_logs (change_version);
              CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_doctor ON doctor_change_logs (doctor_id);
              CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_ho ON doctor_change_logs (head_office_id);
              CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_created ON doctor_change_logs (created_at DESC);
            `);
            console.log('✅ Checked/Created doctor sync columns and doctor_change_logs table');
        } catch (syncErr) {
            console.warn('⚠️ Warning: Failed to create doctor sync schema/indexes:', syncErr.message);
        }

        // Dynamically create smtp_settings table if not exists
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS smtp_settings (
                id SERIAL PRIMARY KEY,
                host VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
                port INTEGER NOT NULL DEFAULT 587,
                secure BOOLEAN NOT NULL DEFAULT false,
                email_user VARCHAR(255) NOT NULL,
                email_pass VARCHAR(255) NOT NULL,
                from_name VARCHAR(255) NOT NULL DEFAULT 'GlucksCare Pharmaceuticals',
                from_email VARCHAR(255),
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `);
            console.log('✅ Checked/Created smtp_settings table');
        } catch (smtpErr) {
            console.warn('⚠️ Warning: Failed to create smtp_settings table:', smtpErr.message);
        }

        // Dynamically create company_settings table if not exists
        try {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS company_settings (
                id SERIAL PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL DEFAULT 'Gluckscare Pharmaceuticals',
                logo_url TEXT NOT NULL DEFAULT '/login/logo.png',
                favicon_url TEXT,
                tagline VARCHAR(255) DEFAULT 'Healthcare & Pharmaceutical ERP',
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
            `);
            // Insert default row if table is empty
            await sequelize.query(`
              INSERT INTO company_settings (company_name, logo_url, tagline)
              SELECT 'Gluckscare Pharmaceuticals', '/login/logo.png', 'Healthcare & Pharmaceutical ERP'
              WHERE NOT EXISTS (SELECT 1 FROM company_settings);
            `);
            console.log('✅ Checked/Created company_settings table and default branding');
        } catch (companyErr) {
            console.warn('⚠️ Warning: Failed to create company_settings table:', companyErr.message);
        }

        return true;
    } catch (error) {
        console.error('❌ Unable to connect to PostgreSQL:', error);
        return false;
    }
}

module.exports = { initializeDatabase };
