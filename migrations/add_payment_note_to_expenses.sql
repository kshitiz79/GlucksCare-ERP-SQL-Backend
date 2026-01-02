-- Add payment_note column to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_note TEXT;

-- Add comment to the column
COMMENT ON COLUMN expenses.payment_note IS 'Optional note added during payment finalization';
