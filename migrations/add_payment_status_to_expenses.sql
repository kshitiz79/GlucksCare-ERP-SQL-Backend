-- Migration: Add payment_status and payment_date to expenses table
-- This allows admin to mark expenses as paid after month completion

-- Add payment_status column (unpaid, paid)
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid'));

-- Add payment_date column to track when payment was made
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;

-- Add payment_month_year column to group payments by month
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_month_year VARCHAR(7);

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_payment_status ON expenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_month_year ON expenses(payment_month_year);

-- Update existing approved expenses to set payment_month_year
UPDATE expenses 
SET payment_month_year = TO_CHAR(date, 'YYYY-MM')
WHERE payment_month_year IS NULL;

COMMENT ON COLUMN expenses.payment_status IS 'Payment status: unpaid (default), paid (after admin finalizes payment)';
COMMENT ON COLUMN expenses.payment_date IS 'Date when admin marked the expense as paid';
COMMENT ON COLUMN expenses.payment_month_year IS 'Month-Year for grouping payments (YYYY-MM format)';
