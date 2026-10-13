// Sql-Backend/scripts/importPolygons.js
// Ingestion script for Bihar pincode territory polygons and post office areas

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

/**
 * Recursively extract all 2D points [lng, lat] from GeoJSON coordinates
 */
function extractPoints(geometry) {
  const points = [];
  function dig(arr) {
    if (!Array.isArray(arr)) return;
    if (arr.length >= 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      points.push(arr);
      return;
    }
    for (const item of arr) {
      dig(item);
    }
  }
  if (geometry && geometry.coordinates) {
    dig(geometry.coordinates);
  }
  return points;
}

/**
 * Calculate geometric center (centroid) for a polygon/multipolygon
 */
function calculateCentroid(geometry) {
  const points = extractPoints(geometry);
  if (!points || points.length === 0) return { latitude: 0, longitude: 0 };
  let sumLng = 0;
  let sumLat = 0;
  for (const pt of points) {
    sumLng += pt[0];
    sumLat += pt[1];
  }
  return {
    latitude: parseFloat((sumLat / points.length).toFixed(6)),
    longitude: parseFloat((sumLng / points.length).toFixed(6))
  };
}

/**
 * Clean postal division name to standardized district name
 */
function cleanDistrict(division) {
  const d = (division || '').trim();
  if (!d) return 'Unknown';
  if (/katihar/i.test(d)) return 'Katihar';
  if (/patna/i.test(d)) return 'Patna';
  if (/aurangabad/i.test(d)) return 'Aurangabad';
  if (/nawad/i.test(d)) return 'Nawada';
  return d;
}

/**
 * Main ingestion function
 */
async function importPolygonData(options = {}) {
  const targetDb = options.models || db;
  const filePath = options.filePath || path.resolve(__dirname, '../../polygon.md');
  const createAreas = options.createAreas !== false;

  console.log(`🚀 Starting Polygon ingestion from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const geojson = JSON.parse(raw);

  if (!geojson.features || !Array.isArray(geojson.features)) {
    throw new Error('Invalid GeoJSON format: features array missing');
  }

  console.log(`📦 Loaded ${geojson.features.length} GeoJSON features`);

  // 1. Sync polygon table if needed
  if (targetDb.Polygon) {
    await targetDb.Polygon.sync({ alter: true });
    console.log('✅ polygon table verified/synced');
  } else {
    throw new Error('targetDb.Polygon model not found');
  }

  // 2. Ensure State "Bihar" exists
  let biharState = await targetDb.State.findOne({
    where: { name: 'Bihar' }
  });

  if (!biharState) {
    biharState = await db.State.create({
      name: 'Bihar',
      code: 'BR',
      country: 'India',
      is_active: true
    });
    console.log(`🏛️ Created State: Bihar (${biharState.id})`);
  } else {
    console.log(`🏛️ Found existing State: Bihar (${biharState.id})`);
  }

  // 3. Pre-scan features to gather distinct districts and calculate district centers & sample pincodes
  const districtStats = {};
  for (const f of geojson.features) {
    const rawDiv = (f.properties?.Division || '').trim();
    const district = cleanDistrict(rawDiv);
    const pin = (f.properties?.Pincode || '').trim();
    const centroid = calculateCentroid(f.geometry);

    if (!districtStats[district]) {
      districtStats[district] = {
        name: district,
        rawDivisions: new Set(),
        pincodes: [],
        centroids: []
      };
    }
    districtStats[district].rawDivisions.add(rawDiv);
    if (pin) districtStats[district].pincodes.push(pin);
    if (centroid.latitude !== 0) districtStats[district].centroids.push(centroid);
  }

  // 4. Ensure Head Office exists for each district in Bihar
  const headOfficeMap = {}; // districtName -> HeadOffice instance
  const existingHQs = await targetDb.HeadOffice.findAll({
    where: { stateId: biharState.id }
  });

  for (const hq of existingHQs) {
    // Check match by name (e.g. "Patna Head Office" or "Patna")
    for (const distName of Object.keys(districtStats)) {
      if (hq.name.toLowerCase().includes(distName.toLowerCase())) {
        headOfficeMap[distName] = hq;
      }
    }
  }

  for (const [distName, stats] of Object.entries(districtStats)) {
    if (!headOfficeMap[distName]) {
      const avgLat = stats.centroids.length > 0
        ? stats.centroids.reduce((s, c) => s + c.latitude, 0) / stats.centroids.length
        : 25.6;
      const avgLng = stats.centroids.length > 0
        ? stats.centroids.reduce((s, c) => s + c.longitude, 0) / stats.centroids.length
        : 85.1;
      const repPin = stats.pincodes[0] || '800001';

      const newHQ = await targetDb.HeadOffice.create({
        name: `${distName} Head Office`,
        stateId: biharState.id,
        pincode: repPin,
        latitude: parseFloat(avgLat.toFixed(6)),
        longitude: parseFloat(avgLng.toFixed(6)),
        is_active: true
      });
      headOfficeMap[distName] = newHQ;
      console.log(`🏢 Created Head Office: ${newHQ.name} (${newHQ.id})`);
    } else {
      console.log(`🏢 Using existing Head Office for ${distName}: ${headOfficeMap[distName].name}`);
    }
  }

  // 5. Ingest all features into `polygon` table
  console.log(`⏳ Ingesting ${geojson.features.length} records into 'polygon' table...`);
  let polygonUpsertCount = 0;
  let areaUpsertCount = 0;

  for (let i = 0; i < geojson.features.length; i++) {
    const f = geojson.features[i];
    const props = f.properties || {};
    const pincode = (props.Pincode || '').trim();
    const officeName = (props.Office_Name || '').trim();
    const division = (props.Division || '').trim();
    const region = (props.Region || '').trim();
    const circle = (props.Circle || 'Bihar').trim();
    const district = cleanDistrict(division);
    const hq = headOfficeMap[district];
    const headOfficeId = hq ? hq.id : null;
    const centroid = calculateCentroid(f.geometry);

    // Upsert into polygon table
    const existingPoly = await targetDb.Polygon.findOne({ where: { pincode } });
    if (existingPoly) {
      await existingPoly.update({
        office_name: officeName,
        division,
        region,
        circle,
        district,
        state: 'Bihar',
        head_office_id: headOfficeId,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        geometry: f.geometry,
        coordinates: f.geometry.coordinates,
        properties: props,
        is_active: true
      });
    } else {
      await targetDb.Polygon.create({
        pincode,
        office_name: officeName,
        division,
        region,
        circle,
        district,
        state: 'Bihar',
        head_office_id: headOfficeId,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        geometry: f.geometry,
        coordinates: f.geometry.coordinates,
        properties: props,
        is_active: true
      });
    }
    polygonUpsertCount++;

    // 6. Also create/update post office area in `areas` table if requested
    if (createAreas && targetDb.Area && headOfficeId) {
      const areaName = officeName;
      const existingArea = await targetDb.Area.findOne({
        where: { pincode, name: areaName }
      });

      if (existingArea) {
        await existingArea.update({
          post_office: officeName,
          head_office_id: headOfficeId,
          latitude: centroid.latitude,
          longitude: centroid.longitude,
          radius: 700,
          is_active: true
        });
      } else {
        await targetDb.Area.create({
          name: areaName,
          pincode,
          post_office: officeName,
          head_office_id: headOfficeId,
          latitude: centroid.latitude,
          longitude: centroid.longitude,
          radius: 700,
          is_active: true
        });
      }
      areaUpsertCount++;
    }

    if ((i + 1) % 100 === 0 || i + 1 === geojson.features.length) {
      console.log(`  Processed ${i + 1}/${geojson.features.length} records...`);
    }
  }

  const finalPolygonCount = await targetDb.Polygon.count();
  const finalAreaCount = targetDb.Area ? await targetDb.Area.count() : 0;

  console.log('🎉 Polygon ingestion completed successfully!');
  console.log(`📊 Summary:`);
  console.log(`   - Polygons processed: ${polygonUpsertCount}`);
  console.log(`   - Total in 'polygon' table: ${finalPolygonCount}`);
  console.log(`   - Post Office areas processed: ${areaUpsertCount}`);
  console.log(`   - Total in 'areas' table: ${finalAreaCount}`);
  console.log(`   - Head Offices linked: ${Object.keys(headOfficeMap).length} districts`);

  return {
    success: true,
    featuresProcessed: geojson.features.length,
    polygonsUpserted: polygonUpsertCount,
    totalPolygons: finalPolygonCount,
    areasUpserted: areaUpsertCount,
    totalAreas: finalAreaCount,
    districtsCovered: Object.keys(headOfficeMap)
  };
}

// Allow standalone CLI execution
if (require.main === module) {
  importPolygonData()
    .then(() => {
      console.log('✅ CLI Ingestion finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Ingestion failed:', err);
      process.exit(1);
    });
}

module.exports = {
  importPolygonData,
  calculateCentroid,
  cleanDistrict,
  extractPoints
};
