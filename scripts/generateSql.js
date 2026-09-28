// scripts/generateSql.js
const fs = require('fs');
const path = require('path');
const defaultFieldOmniColors = require('../src/themeSetting/defaultFieldOmniColors');

let sql = `-- ==========================================================
-- SQL Migration Script: Create & Seed theme_colors table
-- ==========================================================

-- 1. Ensure extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create theme_colors table
CREATE TABLE IF NOT EXISTS theme_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_name VARCHAR(50) NOT NULL DEFAULT 'FieldOmni',
    color_key VARCHAR(100) NOT NULL,
    color_hex VARCHAR(20) NOT NULL,
    color_value_hex_int VARCHAR(20),
    category VARCHAR(50) NOT NULL DEFAULT 'brand',
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_theme_color_key UNIQUE (theme_name, color_key)
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_theme_colors_theme_name ON theme_colors (theme_name);
CREATE INDEX IF NOT EXISTS idx_theme_colors_category ON theme_colors (category);
CREATE INDEX IF NOT EXISTS idx_theme_colors_key ON theme_colors (color_key);

-- 4. Insert / Upsert all 196 FieldOmni default theme colors
INSERT INTO theme_colors (theme_name, color_key, color_hex, color_value_hex_int, category, description, is_active)
VALUES
`;

const valueRows = defaultFieldOmniColors.map(c => {
  const desc = (c.description || '').replace(/'/g, "''");
  return `  ('FieldOmni', '${c.color_key}', '${c.color_hex}', '${c.color_value_hex_int}', '${c.category}', '${desc}', true)`;
});

sql += valueRows.join(',\n');
sql += `
ON CONFLICT (theme_name, color_key) DO UPDATE SET
    color_hex = EXCLUDED.color_hex,
    color_value_hex_int = EXCLUDED.color_value_hex_int,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
`;

const outputPath = path.resolve(__dirname, '../create_theme_colors.sql');
fs.writeFileSync(outputPath, sql);
console.log('✅ Generated create_theme_colors.sql successfully with', defaultFieldOmniColors.length, 'records.');
