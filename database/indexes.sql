-- ============================================
-- Database Indexes for Performance Optimization
-- Run this script on your PostgreSQL database
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_state_id ON users(state_id);

CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_users_state_active ON users(state_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_code_unique ON users(employee_code);

-- HeadOffice table indexes
CREATE INDEX IF NOT EXISTS idx_head_offices_state_id ON head_offices(state_id);
CREATE INDEX IF NOT EXISTS idx_head_offices_is_active ON head_offices(is_active);

-- Many-to-many join table indexes
CREATE INDEX IF NOT EXISTS idx_user_head_offices_user_id ON user_head_offices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_head_offices_head_office_id ON user_head_offices(head_office_id);

-- Locations table indexes - CRITICAL for performance
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_locations_user_timestamp ON locations(user_id, timestamp DESC);

-- Attendance table indexes
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_approved_by ON attendance(approved_by);

-- Expenses table indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- Doctor visits table indexes
CREATE INDEX IF NOT EXISTS idx_doctor_visits_user_id ON doctor_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_doctor_id ON doctor_visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_visits_created_at ON doctor_visits(created_at);

-- Chemist visits table indexes
CREATE INDEX IF NOT EXISTS idx_chemist_visits_user_id ON chemist_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_chemist_visits_chemist_id ON chemist_visits(chemist_id);

-- Stockist visits table indexes
CREATE INDEX IF NOT EXISTS idx_stockist_visits_user_id ON stockist_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_stockist_visits_stockist_id ON stockist_visits(stockist_id);

-- Tickets table indexes
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
CREATE INDEX IF NOT EXISTS idx_users_updated_by ON users(updated_by);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_active_role_state ON users(is_active, role, state_id) WHERE is_active = true;

-- ============================================
-- Verify indexes were created
-- ============================================
-- Run this query to see all indexes on users table:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
