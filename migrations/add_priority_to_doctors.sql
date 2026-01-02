-- Migration: Add priority field to doctors table
-- Purpose: Categorize doctors by service level (A = highest, B = medium, C = standard)
-- Date: 2026-01-02

-- Add priority column with default value 'C'
ALTER TABLE doctors 
ADD COLUMN priority VARCHAR(1) NOT NULL DEFAULT 'C';

-- Add check constraint to ensure only A, B, or C values are allowed
ALTER TABLE doctors
ADD CONSTRAINT doctors_priority_check 
CHECK (priority IN ('A', 'B', 'C'));

-- Update existing records to have default priority 'C' (already set by DEFAULT)
-- This is just for documentation purposes
UPDATE doctors 
SET priority = 'C' 
WHERE priority IS NULL;

-- Create index on priority for better query performance when filtering/sorting
CREATE INDEX idx_doctors_priority ON doctors(priority);

-- Verify the changes
-- SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'doctors' AND column_name = 'priority';
