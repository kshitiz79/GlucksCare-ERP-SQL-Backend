// src/tourPlan/ensureTourPlanSchema.js
// Auto-ensures all tour_plans and tour_plan_days columns, tables, and indexes across all databases

const ensuredDbs = new Set();

async function ensureTourPlanSchema(sequelize, force = false) {
  if (!sequelize) return;
  const dbName = sequelize.config?.database || 'default';

  if (!force && ensuredDbs.has(dbName)) {
    return;
  }

  try {
    // 1. Ensure uuid-ossp or pgcrypto extension for gen_random_uuid()
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    } catch (e) {}

    // 2. Ensure tour_plans table exists
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS tour_plans (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'Draft',
          approved_by_id UUID,
          approved_by_name VARCHAR(255),
          approved_by_role VARCHAR(50),
          comments TEXT,
          direct_changes_count INTEGER NOT NULL DEFAULT 0,
          plan_level VARCHAR(50) NOT NULL DEFAULT 'Manager',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
    } catch (e) {}

    // Ensure all columns in tour_plans
    await sequelize.query("ALTER TABLE tour_plans ADD COLUMN IF NOT EXISTS plan_level VARCHAR(50) DEFAULT 'Manager';").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plans ADD COLUMN IF NOT EXISTS direct_changes_count INTEGER DEFAULT 0;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plans ADD COLUMN IF NOT EXISTS approved_by_id UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plans ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plans ADD COLUMN IF NOT EXISTS approved_by_role VARCHAR(50);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plans ADD COLUMN IF NOT EXISTS comments TEXT;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plans ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';").catch(() => {});

    // 3. Ensure tour_plan_days table exists
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS tour_plan_days (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tour_plan_id UUID NOT NULL,
          date DATE NOT NULL,
          day_type VARCHAR(50) NOT NULL DEFAULT 'Field',
          head_office_id UUID,
          head_office_ids JSONB DEFAULT '[]'::jsonb,
          co_work_with_user_id UUID,
          joint_work_with_user_id UUID,
          joint_work_user_ids JSONB DEFAULT '[]'::jsonb,
          collaboration_statuses JSONB DEFAULT '{}'::jsonb,
          collaboration_status VARCHAR(50) DEFAULT 'None',
          handshake_status VARCHAR(50) DEFAULT 'None',
          handshake_time TIMESTAMP WITH TIME ZONE,
          handshake_distance_meters DECIMAL(10, 2),
          handshake_user_lat DECIMAL(10, 8),
          handshake_user_lng DECIMAL(11, 8),
          handshake_partner_lat DECIMAL(10, 8),
          handshake_partner_lng DECIMAL(11, 8),
          handshake_verified_by_user_id UUID,
          beat_id_1 UUID,
          beat_id_2 UUID,
          change_request_status VARCHAR(50) DEFAULT 'None',
          change_request_reason TEXT,
          change_request_beat_id_1 UUID,
          change_request_beat_id_2 UUID,
          change_request_day_type VARCHAR(50),
          change_request_comments TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
    } catch (e) {}

    // Ensure all columns in tour_plan_days
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS head_office_id UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS head_office_ids JSONB DEFAULT '[]'::jsonb;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS co_work_with_user_id UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS joint_work_with_user_id UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS joint_work_user_ids JSONB DEFAULT '[]'::jsonb;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS collaboration_statuses JSONB DEFAULT '{}'::jsonb;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS collaboration_status VARCHAR(50) DEFAULT 'None';").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_status VARCHAR(50) DEFAULT 'None';").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_time TIMESTAMP WITH TIME ZONE;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_distance_meters DECIMAL(10, 2);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_user_lat DECIMAL(10, 8);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_user_lng DECIMAL(11, 8);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_partner_lat DECIMAL(10, 8);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_partner_lng DECIMAL(11, 8);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS handshake_verified_by_user_id UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS beat_id_1 UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS beat_id_2 UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS change_request_status VARCHAR(50) DEFAULT 'None';").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS change_request_reason TEXT;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS change_request_beat_id_1 UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS change_request_beat_id_2 UUID;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS change_request_day_type VARCHAR(50);").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS change_request_comments TEXT;").catch(() => {});
    await sequelize.query("ALTER TABLE tour_plan_days ADD COLUMN IF NOT EXISTS notes TEXT;").catch(() => {});

    // Try adding foreign keys if possible
    try {
      await sequelize.query("ALTER TABLE tour_plan_days ADD CONSTRAINT fk_tpd_head_office FOREIGN KEY (head_office_id) REFERENCES head_offices(id) ON DELETE SET NULL;");
    } catch (e) {}
    try {
      await sequelize.query("ALTER TABLE tour_plan_days ADD CONSTRAINT fk_tpd_cowork FOREIGN KEY (co_work_with_user_id) REFERENCES users(id) ON DELETE SET NULL;");
    } catch (e) {}

    // Indexes
    await sequelize.query("CREATE INDEX IF NOT EXISTS idx_tour_plans_user_month_year ON tour_plans (user_id, month, year);").catch(() => {});
    await sequelize.query("CREATE INDEX IF NOT EXISTS idx_tour_plan_days_date ON tour_plan_days (date);").catch(() => {});
    await sequelize.query("CREATE INDEX IF NOT EXISTS idx_tour_plan_days_plan_id ON tour_plan_days (tour_plan_id);").catch(() => {});
    await sequelize.query("CREATE INDEX IF NOT EXISTS idx_tour_plan_days_head_office ON tour_plan_days (head_office_id);").catch(() => {});
    await sequelize.query("CREATE INDEX IF NOT EXISTS idx_tour_plan_days_cowork ON tour_plan_days (co_work_with_user_id);").catch(() => {});

    ensuredDbs.add(dbName);
  } catch (err) {
    console.warn(`[ensureTourPlanSchema] Warning for ${dbName}:`, err.message);
  }
}

module.exports = {
  ensureTourPlanSchema
};
