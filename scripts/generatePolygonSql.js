// Sql-Backend/scripts/generatePolygonSql.js
// Script to generate complete SQL migration & seed file for polygon table from polygon.md

const fs = require('fs');
const path = require('path');
const { calculateCentroid, cleanDistrict } = require('./importPolygons');

function generateSql() {
  const mdPath = path.resolve(__dirname, '../polygon.md');
  const fallbackPath = path.resolve(__dirname, '../../polygon.md');
  const sourcePath = fs.existsSync(mdPath) ? mdPath : fallbackPath;

  if (!fs.existsSync(sourcePath)) {
    console.error('❌ Could not find polygon.md');
    process.exit(1);
  }

  console.log('📖 Reading GeoJSON from:', sourcePath);
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const geojson = JSON.parse(raw);

  if (!geojson.features || !Array.isArray(geojson.features)) {
    console.error('❌ Invalid GeoJSON format: features array missing');
    process.exit(1);
  }

  console.log(`📦 Loaded ${geojson.features.length} features`);

  let sql = `-- ==========================================================
-- SQL Migration Script: Create & Seed polygon table
-- Auto-generated from polygon.md (${geojson.features.length} features)
-- ==========================================================

-- 1. Ensure UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create polygon table
CREATE TABLE IF NOT EXISTS polygon (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pincode VARCHAR(20) NOT NULL UNIQUE,
    office_name VARCHAR(255) NOT NULL,
    division VARCHAR(255),
    region VARCHAR(255),
    circle VARCHAR(255),
    district VARCHAR(255),
    state VARCHAR(255) DEFAULT 'Bihar',
    head_office_id UUID REFERENCES head_offices(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION DEFAULT 0,
    longitude DOUBLE PRECISION DEFAULT 0,
    geometry JSONB NOT NULL,
    coordinates JSONB,
    properties JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_polygon_pincode ON polygon (pincode);
CREATE INDEX IF NOT EXISTS idx_polygon_district ON polygon (district);
CREATE INDEX IF NOT EXISTS idx_polygon_division ON polygon (division);
CREATE INDEX IF NOT EXISTS idx_polygon_state ON polygon (state);
CREATE INDEX IF NOT EXISTS idx_polygon_ho_id ON polygon (head_office_id);

-- 4. Seed Polygons
`;

  // Insert in batches of 100 to avoid huge query buffers in psql
  const BATCH_SIZE = 100;
  for (let i = 0; i < geojson.features.length; i += BATCH_SIZE) {
    const batch = geojson.features.slice(i, i + BATCH_SIZE);
    sql += `\n-- Batch ${Math.floor(i / BATCH_SIZE) + 1}\n`;
    sql += `INSERT INTO polygon (pincode, office_name, division, region, circle, district, state, latitude, longitude, geometry, coordinates, properties, is_active)\nVALUES\n`;

    const rowStrings = batch.map(f => {
      const props = f.properties || {};
      const pin = (props.Pincode || '').trim().replace(/'/g, "''");
      const name = (props.Office_Name || '').trim().replace(/'/g, "''");
      const division = (props.Division || '').trim().replace(/'/g, "''");
      const region = (props.Region || '').trim().replace(/'/g, "''");
      const circle = (props.Circle || 'Bihar').trim().replace(/'/g, "''");
      const district = cleanDistrict(division).replace(/'/g, "''");
      const centroid = calculateCentroid(f.geometry);

      const geomJson = JSON.stringify(f.geometry).replace(/'/g, "''");
      const coordsJson = JSON.stringify(f.geometry.coordinates).replace(/'/g, "''");
      const propsJson = JSON.stringify(props).replace(/'/g, "''");

      return `  ('${pin}', '${name}', '${division}', '${region}', '${circle}', '${district}', 'Bihar', ${centroid.latitude}, ${centroid.longitude}, '${geomJson}'::jsonb, '${coordsJson}'::jsonb, '${propsJson}'::jsonb, true)`;
    });

    sql += rowStrings.join(',\n');
    sql += `\nON CONFLICT (pincode) DO UPDATE SET\n`;
    sql += `  office_name = EXCLUDED.office_name,\n`;
    sql += `  division = EXCLUDED.division,\n`;
    sql += `  region = EXCLUDED.region,\n`;
    sql += `  circle = EXCLUDED.circle,\n`;
    sql += `  district = EXCLUDED.district,\n`;
    sql += `  state = EXCLUDED.state,\n`;
    sql += `  latitude = EXCLUDED.latitude,\n`;
    sql += `  longitude = EXCLUDED.longitude,\n`;
    sql += `  geometry = EXCLUDED.geometry,\n`;
    sql += `  coordinates = EXCLUDED.coordinates,\n`;
    sql += `  properties = EXCLUDED.properties,\n`;
    sql += `  is_active = EXCLUDED.is_active,\n`;
    sql += `  updated_at = NOW();\n`;
  }

  // Also link to head_offices by matching district name
  sql += `
-- 5. Auto-link Polygons to Head Offices where head_office name matches district
UPDATE polygon p
SET head_office_id = ho.id
FROM head_offices ho
WHERE p.head_office_id IS NULL
  AND LOWER(ho.name) LIKE '%' || LOWER(p.district) || '%';
`;

  const outputPath = path.resolve(__dirname, '../database/seed_polygons.sql');
  fs.writeFileSync(outputPath, sql);
  console.log(`✅ Generated ${outputPath} successfully (${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB) with ${geojson.features.length} records.`);
}

if (require.main === module) {
  generateSql();
}

module.exports = { generateSql };
