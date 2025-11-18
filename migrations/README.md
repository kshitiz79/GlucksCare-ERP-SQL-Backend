# Database Migrations

This folder contains SQL migration files that need to be run on the database.

## Pending Migrations

### 1. Add advance_date to advances
**File:** `add_advance_date_to_advances.sql`
**Purpose:** Adds an `advance_date` column to track when advance was taken

**To apply:**
```bash
psql -U your_username -d your_database_name -f add_advance_date_to_advances.sql
```

## How to Run Migrations

### For PostgreSQL:
```bash
# Connect to your database
psql -U postgres -d gluckscare_erp_production

# Run a migration file
\i /path/to/migration/file.sql

# Or run directly
psql -U postgres -d gluckscare_erp_production -f migration_file.sql
```

### For MySQL:
```bash
mysql -u root -p your_database_name < migration_file.sql
```

## After Running Migrations

1. **Restart the backend server:**
   ```bash
   pm2 restart gluckcare-backend
   # or
   npm run dev
   ```

2. **Verify the changes:**
   ```bash
   # PostgreSQL
   \d+ table_name
   
   # MySQL
   DESCRIBE table_name;
   ```

## Migration Status

- [ ] add_advance_date_to_advances.sql - **PENDING** (Model field is active)

## Notes

- Visit times are extracted from the `created_at` timestamp and converted to IST
- The `advance_date` field is already active in the Advance model
- Migration includes default value updates for existing records
