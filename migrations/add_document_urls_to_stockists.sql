-- Add document URL columns to stockists table
-- This migration adds columns to store URLs of uploaded documents for stockists

ALTER TABLE stockists 
ADD COLUMN IF NOT EXISTS gst_certificate_url VARCHAR(500);

ALTER TABLE stockists 
ADD COLUMN IF NOT EXISTS drug_license_url VARCHAR(500);

ALTER TABLE stockists 
ADD COLUMN IF NOT EXISTS pan_card_url VARCHAR(500);

ALTER TABLE stockists 
ADD COLUMN IF NOT EXISTS cancelled_cheque_url VARCHAR(500);

ALTER TABLE stockists 
ADD COLUMN IF NOT EXISTS business_profile_url VARCHAR(500);

