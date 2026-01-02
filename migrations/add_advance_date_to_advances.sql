-- Add advance_date column to advances table
-- This tracks the actual date when the advance was taken/disbursed

ALTER TABLE advances 
ADD COLUMN advance_date DATE;



UPDATE advances 
SET advance_date = approval_date
WHERE status = 'approved' AND approval_date IS NOT NULL;


UPDATE advances 
SET advance_date = DATE(request_date)
WHERE status = 'pending';
