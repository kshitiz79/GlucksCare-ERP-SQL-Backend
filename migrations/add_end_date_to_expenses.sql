-- Add end_date column to expenses table
-- This tracks the end date for date range expenses

ALTER TABLE expenses
ADD COLUMN end_date DATE;

-- Add comment
COMMENT ON COLUMN expenses.end_date IS 'End date for date range expenses (Quick Add feature)';
