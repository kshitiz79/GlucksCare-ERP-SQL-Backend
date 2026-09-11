// src/config/ensureSyncSchema.js
// Auto-ensures doctor change tracking table, sequence, and indexes across all tenant databases

async function ensureTenantSyncSchema(sequelize) {
  if (!sequelize) return;
  try {
    // 1. Ensure uuid-ossp or pgcrypto extension for gen_random_uuid()
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    } catch (e) {}

    // 2. Ensure sequence for monotonic change tracking
    try {
      await sequelize.query('CREATE SEQUENCE IF NOT EXISTS doctor_change_version_seq;');
    } catch (e) {}

    // 3. Ensure doctors table columns exist
    try {
      await sequelize.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS client_generated_id VARCHAR(100);');
    } catch (e) {}
    try {
      await sequelize.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS sync_version BIGINT DEFAULT 1;');
    } catch (e) {}

    // 4. Ensure doctor_change_logs table exists
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
    } catch (e) {}

    // 5. Ensure performance indexes
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_doctors_client_gen_id ON doctors (client_generated_id);
        CREATE INDEX IF NOT EXISTS idx_doctors_sync_version ON doctors (sync_version);
        CREATE INDEX IF NOT EXISTS idx_doctors_created_at ON doctors (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_version ON doctor_change_logs (change_version);
        CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_doctor ON doctor_change_logs (doctor_id);
        CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_ho ON doctor_change_logs (head_office_id);
        CREATE INDEX IF NOT EXISTS idx_doctor_change_logs_created ON doctor_change_logs (created_at DESC);
      `);
    } catch (e) {}
  } catch (err) {
    console.warn('⚠️ [ensureTenantSyncSchema] Warning:', err.message);
  }
}

module.exports = {
  ensureTenantSyncSchema
};
