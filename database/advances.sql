CREATE TABLE IF NOT EXISTS advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    requested_amount NUMERIC(10, 2) NOT NULL,
    approved_amount NUMERIC(10, 2) DEFAULT 0,
    
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'partially_approved')) DEFAULT 'pending',

    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_date TIMESTAMP NULL,

    approved_by UUID NULL,
    reason TEXT NOT NULL,
    admin_notes TEXT NULL,

    repayment_status TEXT CHECK (repayment_status IN ('pending', 'in_progress', 'completed')) DEFAULT 'pending',

    repayment_start_date DATE NULL,
    repayment_end_date DATE NULL,
    monthly_deduction NUMERIC(10, 2) DEFAULT 0,
    total_repaid NUMERIC(10, 2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Add indexes (Postgres style)
CREATE INDEX IF NOT EXISTS idx_advances_user_id ON advances(user_id);
CREATE INDEX IF NOT EXISTS idx_advances_status ON advances(status);
CREATE INDEX IF NOT EXISTS idx_advances_request_date ON advances(request_date);


CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_advances_timestamp
BEFORE UPDATE ON advances
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();



CREATE TABLE IF NOT EXISTS advance_repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    advance_id UUID NOT NULL,
    repayment_date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,

    payment_method TEXT CHECK 
       (payment_method IN ('salary_deduction', 'cash', 'bank_transfer', 'other')) 
       DEFAULT 'salary_deduction',

    notes TEXT NULL,
    created_by UUID NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (advance_id) REFERENCES advances(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_repayments_advance_id ON advance_repayments(advance_id);
CREATE INDEX IF NOT EXISTS idx_repayments_date ON advance_repayments(repayment_date);
