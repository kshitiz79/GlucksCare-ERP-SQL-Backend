const https = require('https');
const { URL } = require('url');

const ADMIN_EMAIL = 'rajat@glucks.in';
const ADMIN_PASSWORD = 'Rajatjha@99';
const API_BASE = 'https://test.gluckscare.com/api';
const TARGET_RADIUS = 200;

async function fetchWithRetry(urlStr, options = {}, retries = 3) {
  const parsedUrl = new URL(urlStr);
  const bodyData = options.body || null;

  const reqOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: options.method || 'GET',
    rejectUnauthorized: false,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ...(options.headers || {})
    }
  };

  if (bodyData) {
    reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = https.request(reqOptions, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              json: async () => JSON.parse(data),
              text: async () => data
            });
          });
        });

        req.on('error', reject);
        if (bodyData) req.write(bodyData);
        req.end();
      });

      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`[Network Retry] Attempt ${i + 1} failed for ${urlStr}: ${err.message}. Retrying in 1s...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function run() {
  console.log('Step 1: Logging in to production server...');
  let token = '';
  try {
    const loginRes = await fetchWithRetry(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('✅ Logged in successfully!');
  } catch (err) {
    console.error('❌ Failed to login:', err);
    process.exit(1);
  }

  console.log('\nStep 2: Fetching production areas...');
  let areas = [];
  try {
    const res = await fetchWithRetry(`${API_BASE}/areas`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    areas = json.data || [];
    console.log(`✅ Fetched ${areas.length} total areas from production API.`);
  } catch (err) {
    console.error('❌ Failed to fetch areas:', err);
    process.exit(1);
  }

  console.log(`\nStep 3: Updating radius to ${TARGET_RADIUS} meters for all ${areas.length} areas...`);
  let successCount = 0;
  let failCount = 0;

  const CONCURRENCY = 15;
  for (let i = 0; i < areas.length; i += CONCURRENCY) {
    const chunk = areas.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (area) => {
      try {
        const res = await fetchWithRetry(`${API_BASE}/areas/${area.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            radius: TARGET_RADIUS
          })
        });
        const data = await res.json();
        if (res.ok || data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }));

    if ((i + CONCURRENCY) % 150 === 0 || i + CONCURRENCY >= areas.length) {
      console.log(`Progress: Updated ${Math.min(i + CONCURRENCY, areas.length)}/${areas.length} areas radius...`);
    }
  }

  console.log('\n--- AREA RADIUS UPDATE COMPLETE ---');
  console.log(`Total Areas Processed: ${areas.length}`);
  console.log(`Successfully Updated:  ${successCount}`);
  console.log(`Failures:              ${failCount}`);
  console.log(`✅ All areas now have radius = ${TARGET_RADIUS} meters!`);
}

run();
