// src/delhivery/delhiveryRoutes.js
// Server-side proxy for Delhivery API — avoids CORS on frontend
// React → This backend → Delhivery API

const express = require('express');
const https = require('https');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/authMiddleware');

const DELHIVERY_TOKEN    = process.env.DELHIVERY_API_TOKEN;
const DELHIVERY_BASE     = (process.env.DELHIVERY_BASE_URL || 'https://track.delhivery.com')
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '');
const PICKUP_LOCATION    = process.env.DELHIVERY_PICKUP_LOCATION || '';

let _delhiveryB2BToken     = process.env.DELHIVERY_B2B_TOKEN || '';
let _delhiveryB2BClientId = process.env.DELHIVERY_B2B_CLIENT_ID || '';
const DELHIVERY_UCP_HOST  = 'ucp-egw.delhivery.com';
const DELHIVERY_UCP_PATH  = '/101/api/v1/lrn/shipment/list';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delhivery/config
// Returns current server-side Delhivery config (token masked, pickup location)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/config', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      token_set: !!DELHIVERY_TOKEN,
      token_preview: DELHIVERY_TOKEN ? `...${DELHIVERY_TOKEN.slice(-6)}` : null,
      pickup_location: PICKUP_LOCATION || null,
      pickup_location_set: !!PICKUP_LOCATION,
      b2b_token_set: !!_delhiveryB2BToken,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/delhivery/b2b-token
// Update in-memory B2B token dynamically without restarting server
// ─────────────────────────────────────────────────────────────────────────────
router.post('/b2b-token', authMiddleware, (req, res) => {
  const { token, client_id } = req.body;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ success: false, message: 'Valid B2B token is required' });
  }
  _delhiveryB2BToken = token.trim();
  if (client_id && typeof client_id === 'string') {
    _delhiveryB2BClientId = client_id.trim();
  }
  return res.json({
    success: true,
    message: 'B2B token updated successfully',
  });
});

// ─── Delhivery API correct values (confirmed by testing) ─────────────────────
// md  : 'E' = Express,  'S' = Surface
// ss  : 'Delivered' = forward delivery,  'RTO' = return,  'DTO' = deliver to origin
// cgm : weight in grams (NOT kg — multiply kg × 1000)
// cod : COD amount in rupees (optional)
// ─────────────────────────────────────────────────────────────────────────────

// Helper: server-side HTTPS GET to Delhivery
const delhiveryGet = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: DELHIVERY_BASE,
      path,
      method: 'GET',
      headers: {
        Authorization: `Token ${DELHIVERY_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delhivery/pincode/:pin
// Check if a pincode is serviceable by Delhivery
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pincode/:pin', authMiddleware, async (req, res) => {
  const { pin } = req.params;

  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ success: false, message: 'Invalid pincode — must be 6 digits.' });
  }

  try {
    const { status, body } = await delhiveryGet(
      `/c/api/pin-codes/json/?filter_codes=${pin}`
    );

    if (status !== 200) {
      return res.status(status).json({
        success: false,
        message: `Delhivery API error (${status})`,
        raw: body,
      });
    }

    return res.json({ success: true, data: body });
  } catch (err) {
    console.error('[Delhivery] pincode error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reach Delhivery API' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delhivery/freight
// Estimate freight charges
//
// Query params (sent by frontend):
//   o_pin        — origin pincode (6 digits)
//   d_pin        — destination pincode (6 digits)
//   weight_kg    — weight in kg  (we convert to grams for Delhivery)
//   mode         — 'Surface' | 'Express'  (we map to S / E)
//   payment_mode — 'Prepaid' | 'COD'      (we map to Delivered / Delivered+cod)
//   cod_amount   — COD amount in ₹ (only when payment_mode=COD)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/freight', authMiddleware, async (req, res) => {
  const { o_pin, d_pin, weight_kg, mode = 'Surface', payment_mode = 'Prepaid', cod_amount } = req.query;

  // Validate required fields
  if (!o_pin || !d_pin || !weight_kg) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: o_pin, d_pin, weight_kg',
    });
  }

  if (!/^\d{6}$/.test(o_pin) || !/^\d{6}$/.test(d_pin)) {
    return res.status(400).json({ success: false, message: 'Invalid pincode format — must be 6 digits' });
  }

  const weightNum = parseFloat(weight_kg);
  if (isNaN(weightNum) || weightNum <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid weight' });
  }

  // Map frontend-friendly values → Delhivery API values
  const md  = mode === 'Express' ? 'E' : 'S';          // E = Express, S = Surface
  const ss  = 'Delivered';                              // forward delivery
  const cgm = Math.round(weightNum * 1000);             // kg → grams

  try {
    let path = `/api/kinko/v1/invoice/charges/.json?md=${md}&ss=${ss}&d_pin=${d_pin}&o_pin=${o_pin}&cgm=${cgm}`;

    // Add COD amount if payment mode is COD
    if (payment_mode === 'COD' && cod_amount && parseFloat(cod_amount) > 0) {
      path += `&cod=${cod_amount}`;
    }

    console.log('[Delhivery] freight request path:', path);

    const { status, body } = await delhiveryGet(path);

    if (status !== 200) {
      console.error('[Delhivery] freight API error:', status, body);
      return res.status(status).json({
        success: false,
        message: typeof body === 'object' ? (body.error || 'Delhivery API error') : body,
        raw: body,
      });
    }

    // body is an array — return first element (Delivered scenario)
    const result = Array.isArray(body) ? body[0] : body;

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Delhivery] freight error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reach Delhivery API' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delhivery/b2b-freight
// B2B Serviceability & Rate Calculator
// Supports multiple boxes with dimensions (volumetric weight)
//
// Query params:
//   o_pin        — origin pincode
//   d_pin        — destination pincode
//   weight_kg    — total shipment dead weight in kg
//   shipment_amt — shipment value in ₹
//   payment_mode — 'Prepaid' | 'COD'
//   cod_amount   — COD amount (if COD)
//   mode         — 'Surface' | 'Express'
//   vol_cm3      — total volumetric cm³ (L×B×H × boxes, sent by frontend)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/b2b-freight', authMiddleware, async (req, res) => {
  const { o_pin, d_pin, weight_kg, payment_mode = 'Prepaid', cod_amount, mode = 'Surface', vol_cm3 } = req.query;

  if (!o_pin || !d_pin || !weight_kg) {
    return res.status(400).json({ success: false, message: 'Missing required fields: o_pin, d_pin, weight_kg' });
  }
  if (!/^\d{6}$/.test(o_pin) || !/^\d{6}$/.test(d_pin)) {
    return res.status(400).json({ success: false, message: 'Invalid pincode format' });
  }

  const weightNum = parseFloat(weight_kg);
  if (isNaN(weightNum) || weightNum <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid weight' });
  }

  const md  = mode === 'Express' ? 'E' : 'S';
  const ss  = 'Delivered';

  // Volumetric weight calculation: vol_cm3 / 5000 (kg)
  // Chargeable weight is the higher of dead weight vs volumetric weight
  let chargedWeightKg = weightNum;
  if (vol_cm3 && parseFloat(vol_cm3) > 0) {
    const volKg = parseFloat(vol_cm3) / 5000;
    chargedWeightKg = Math.max(weightNum, volKg);
  }
  const cgm = Math.round(chargedWeightKg * 1000); // kg → grams

  try {
    let path = `/api/kinko/v1/invoice/charges/.json?md=${md}&ss=${ss}&d_pin=${d_pin}&o_pin=${o_pin}&cgm=${cgm}`;
    if (payment_mode === 'COD' && cod_amount && parseFloat(cod_amount) > 0) {
      path += `&cod=${cod_amount}`;
    }

    console.log('[Delhivery] b2b-freight path:', path);
    const { status, body } = await delhiveryGet(path);

    if (typeof body === 'string' && (body.includes('<html') || body.includes('<!DOCTYPE'))) {
      return res.status(502).json({
        success: false,
        message: `Delhivery returned an unexpected non-JSON response (${status}) — check API status/credentials.`,
      });
    }

    if (status !== 200) {
      return res.status(status).json({
        success: false,
        message: typeof body === 'object' ? (body.error || 'Delhivery API error') : body,
        raw: body,
      });
    }

    const result = Array.isArray(body) ? body[0] : body;
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Delhivery] b2b-freight error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reach Delhivery API' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: server-side HTTPS POST to Delhivery (form-encoded)
// Delhivery create shipment requires: format=json + data=<JSON string>
// as application/x-www-form-urlencoded — NOT raw JSON body
// ─────────────────────────────────────────────────────────────────────────────
const delhiveryPost = (path, formBody) => {
  return new Promise((resolve, reject) => {
    const postData = formBody; // already URL-encoded string
    const options = {
      hostname: DELHIVERY_BASE,
      path,
      method: 'POST',
      headers: {
        Authorization: `Token ${DELHIVERY_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/delhivery/create-shipment
// Create a new shipment / waybill
//
// Body (JSON from frontend):
//   consignee_name, consignee_address, consignee_pin, consignee_phone,
//   consignee_city, consignee_state, order_id, payment_mode (Prepaid|COD),
//   cod_amount, weight_kg, products_desc, seller_name, seller_pin,
//   seller_address, seller_city, seller_state, pickup_location
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create-shipment', authMiddleware, async (req, res) => {
  const {
    consignee_name, consignee_address, consignee_pin, consignee_phone,
    consignee_city = '', consignee_state = '',
    order_id, payment_mode = 'Prepaid', cod_amount = 0,
    weight_kg = 0.5, products_desc = 'Pharmaceutical Products',
    seller_name = 'GlucksCare Pharmaceuticals',
    seller_pin = '201306',
    seller_address = 'T3-236, Golden I, Techzone IV, Greater Noida West',
    seller_city = 'Greater Noida',
    seller_state = 'Uttar Pradesh',
    pickup_location = PICKUP_LOCATION,
    quantity = 1,
    total_amount = 0,
    hsn_code = '3004',
  } = req.body;

  // Validate required fields
  if (!consignee_name || !consignee_address || !consignee_pin || !consignee_phone || !order_id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: consignee_name, consignee_address, consignee_pin, consignee_phone, order_id',
    });
  }

  if (!pickup_location || !pickup_location.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Pickup location is not configured. Please set DELHIVERY_PICKUP_LOCATION in .env or enter a valid pickup location registered with Delhivery.',
    });
  }

  if (!/^\d{6}$/.test(consignee_pin)) {
    return res.status(400).json({ success: false, message: 'Invalid consignee pincode' });
  }

  const weightGrams = Math.round(parseFloat(weight_kg) * 1000);

  const shipmentPayload = {
    shipments: [{
      name: consignee_name,
      add: consignee_address,
      pin: consignee_pin,
      city: consignee_city,
      state: consignee_state,
      country: 'India',
      phone: String(consignee_phone),
      order: order_id,
      payment_mode: payment_mode === 'COD' ? 'COD' : 'Prepaid',
      cod_amount: payment_mode === 'COD' ? parseFloat(cod_amount) : 0,
      weight: weightGrams,
      products_desc,
      hsn_code,
      seller_name,
      seller_add: seller_address,
      seller_pin,
      seller_city,
      seller_state,
      seller_cst_no: '',
      seller_tin_no: '',
      quantity: parseInt(quantity),
      total_amount: parseFloat(total_amount),
    }],
    pickup_location: pickup_location.trim(),
  };

  // Delhivery requires form-encoded: format=json&data=<JSON string>
  const formBody = `format=json&data=${encodeURIComponent(JSON.stringify(shipmentPayload))}`;

  try {
    console.log('[Delhivery] create-shipment payload:', JSON.stringify(shipmentPayload, null, 2));
    const { status, body } = await delhiveryPost('/api/cmu/create.json', formBody);

    console.log('[Delhivery] create-shipment response:', status, JSON.stringify(body));

    if (typeof body === 'string' && (body.includes('<html') || body.includes('<!DOCTYPE'))) {
      return res.status(502).json({
        success: false,
        message: `Delhivery returned a gateway HTML response (${status}) — check API credentials and endpoint.`,
      });
    }

    // Delhivery returns 200 even on errors — check body.success
    if (body.error || !body.success) {
      return res.status(200).json({
        success: false,
        message: body.rmk || 'Shipment creation failed',
        raw: body,
      });
    }

    return res.json({
      success: true,
      message: 'Shipment created successfully',
      data: {
        waybill: body.packages?.[0]?.waybill || body.upload_wbn,
        packages: body.packages || [],
        package_count: body.package_count,
        cod_count: body.cod_count,
        prepaid_count: body.prepaid_count,
        raw: body,
      },
    });
  } catch (err) {
    console.error('[Delhivery] create-shipment error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reach Delhivery API' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delhivery/track/:waybill
// Track a shipment by waybill number
// ─────────────────────────────────────────────────────────────────────────────
router.get('/track/:waybill', authMiddleware, async (req, res) => {
  const { waybill } = req.params;

  if (!waybill || waybill.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Invalid waybill number' });
  }

  const wb = waybill.trim();

  // ── Detect BEFORE making any API call ────────────────────────────────────
  // B2B LR numbers: 7–10 digits (e.g. 304109647 = 9 digits)
  // B2C Express waybills: 11–18 digits (e.g. 1234567890123 = 13 digits)
  const isLikelyB2B = /^\d{7,10}$/.test(wb);

  // Short-circuit for B2B — no point calling Express API, it will always fail
  if (isLikelyB2B) {
    console.log('[Delhivery] B2B LR detected, skipping Express API:', wb);
    return res.json({
      success: true,
      type: 'b2b',
      data: {
        waybill: wb,
        tracking_url: `https://track.delhivery.com/p/lr/${wb}`,
        public_url: `https://www.delhivery.com/track/package/${wb}`,
        message: 'B2B LR — open Delhivery portal to track',
      },
    });
  }

  // ── B2C Express waybill — call the API ───────────────────────────────────
  try {
    const { status, body } = await delhiveryGet(
      `/api/v1/packages/json/?waybill=${encodeURIComponent(wb)}`
    );

    console.log('[Delhivery] B2C track response:', status, JSON.stringify(body).slice(0, 200));

    if (typeof body === 'string' && (body.includes('<html') || body.includes('<!DOCTYPE'))) {
      return res.status(502).json({
        success: false,
        message: 'Delhivery returned an unexpected non-JSON response.',
      });
    }

    if (status === 200 && body.Success !== false && body.ShipmentData?.length > 0) {
      const shipmentData = body.ShipmentData[0]?.Shipment || null;
      return res.json({
        success: true,
        type: 'b2c',
        data: { waybill: wb, shipment: shipmentData, raw: body },
      });
    }

    return res.json({
      success: false,
      message: body.Error || body.rmk || 'Waybill not found. Check the number and try again.',
    });

  } catch (err) {
    console.error('[Delhivery] track error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reach Delhivery API' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delhivery/label/:waybill
// Returns label metadata and points to internal secure streaming endpoint
// ─────────────────────────────────────────────────────────────────────────────
router.get('/label/:waybill', authMiddleware, async (req, res) => {
  const { waybill } = req.params;

  if (!waybill || waybill.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Invalid waybill number' });
  }

  try {
    const cleanWb = waybill.trim();
    // Verify the label exists with Delhivery API
    const { status, body } = await delhiveryGet(
      `/api/p/packing_slip?wbns=${encodeURIComponent(cleanWb)}&token=${DELHIVERY_TOKEN}`
    );

    console.log('[Delhivery] label verification response:', status, typeof body === 'object' ? JSON.stringify(body).slice(0, 300) : body);

    if (status !== 200) {
      return res.status(status).json({ success: false, message: 'Label not available from Delhivery' });
    }

    // If packages_found is 0, waybill doesn't exist
    if (body.packages_found === 0 || (Array.isArray(body.packages) && body.packages.length === 0)) {
      return res.json({
        success: false,
        message: 'No label found for this waybill. Ensure the shipment was created successfully.',
      });
    }

    // Return backend proxy endpoint (NO Delhivery token leaked!)
    const labelUrl = `/api/delhivery/label-file/${cleanWb}`;

    return res.json({
      success: true,
      data: {
        waybill: cleanWb,
        label_url: labelUrl,
        packages: body.packages || [],
        packages_found: body.packages_found,
      },
    });
  } catch (err) {
    console.error('[Delhivery] label error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reach Delhivery API' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/delhivery/label-file/:waybill
// Securely streams the Delhivery PDF packing slip to the client.
// Protected by application authentication — DELHIVERY_TOKEN is NEVER sent to browser!
// ─────────────────────────────────────────────────────────────────────────────
router.get('/label-file/:waybill', async (req, res) => {
  const { waybill } = req.params;

  if (!waybill || waybill.trim().length < 5) {
    return res.status(400).send('Invalid waybill number');
  }

  // Support auth via Authorization header OR ?token query param for iframe/downloads
  const userToken = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token;
  if (!userToken) {
    return res.status(401).send('Authentication required');
  }

  try {
    jwt.verify(userToken, process.env.JWT_SECRET || '12377hhhhyujhgf4567890kijuhytgfr');
  } catch {
    return res.status(401).send('Invalid or expired authentication token');
  }

  if (!DELHIVERY_TOKEN) {
    return res.status(500).send('Delhivery API token is not configured on server');
  }

  const cleanWb = waybill.trim();
  const targetPath = `/api/p/packing_slip?wbns=${encodeURIComponent(cleanWb)}&token=${DELHIVERY_TOKEN}`;

  const options = {
    hostname: DELHIVERY_BASE,
    path: targetPath,
    method: 'GET',
    headers: {
      Accept: 'application/pdf, application/json, */*',
    },
  };

  const proxyReq = https.request(options, (pdfRes) => {
    if (pdfRes.statusCode !== 200) {
      return res.status(pdfRes.statusCode).send('Failed to fetch label from Delhivery');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="label-${cleanWb}.pdf"`);
    pdfRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Delhivery] label-file streaming error:', err.message);
    res.status(500).send('Failed to stream label PDF');
  });

  proxyReq.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: POST to Delhivery UCP gateway
// ─────────────────────────────────────────────────────────────────────────────
const delhiveryB2BPost = (body) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: DELHIVERY_UCP_HOST,
      path:     DELHIVERY_UCP_PATH,
      method:   'POST',
      headers: {
        Authorization:    `Bearer ${_delhiveryB2BToken}`,
        'Content-Type':   'application/json',
        Accept:           'application/json, text/plain, */*',
        'x-hq-client-id': _delhiveryB2BClientId,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

router.get('/b2b-track', authMiddleware, async (req, res) => {
  const { lrnum } = req.query;

  if (!lrnum || lrnum.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'LR number is required' });
  }

  const lr = lrnum.trim();
  const fallback = {
    tracking_url: `https://one.delhivery.com/shipments/b2b?lrn=${lr}`,
    public_url:   `https://www.delhivery.com/track/package/${lr}`,
  };

  if (!_delhiveryB2BToken) {
    return res.json({
      success: false, no_token: true,
      message: 'B2B token not set. Paste fresh token from one.delhivery.com Network tab into DELHIVERY_B2B_TOKEN in .env',
      fallback,
    });
  }

  try {
    console.log('[Delhivery B2B] tracking LR:', lr);
    const { status, body } = await delhiveryB2BPost({ lrnNumbers: [lr] });
    console.log('[Delhivery B2B] response:', status, JSON.stringify(body).slice(0, 200));

    // Broadened token expiration & auth failure check
    const authFailed = status === 401 || status === 403
      || [401, 403].includes(body?.statusCode)
      || /unauthorized|expired|invalid.?token|jwt/i.test(typeof body === 'string' ? body : (body?.message || body?.error || ''));

    if (authFailed) {
      return res.json({
        success: false, token_expired: true,
        message: 'B2B token expired or invalid. Please update B2B Token.',
        fallback,
      });
    }

    if (status !== 200 || !body?.shipment_list) {
      return res.json({
        success: false,
        message: body?.message || `Delhivery B2B API error (${status})`,
        fallback,
      });
    }

    // Find the specific LR in the list (API may return multiple)
    const shipment = body.shipment_list.find(s => s.lrn === lr) || body.shipment_list[0] || null;

    if (!shipment) {
      return res.json({ success: false, message: 'LR not found in response', fallback });
    }

    return res.json({
      success: true,
      data: {
        lrnum:           shipment.lrn,
        mwn:             shipment.mwn,
        status:          shipment.shipment_status,
        status_type:     shipment.status_type,
        consignee:       shipment.consignee_details?.name,
        origin_city:     shipment.origin?.city,
        origin_state:    shipment.origin?.state,
        dest_city:       shipment.destination?.city,
        dest_state:      shipment.destination?.state,
        pickup_from:     shipment.pickup_details?.client_warehouse_name,
        boxes:           shipment.box_count,
        freight:         shipment.freight_total,
        payment_mode:    shipment.payment_mode,
        invoice_num:     shipment.invoice_details?.[0]?.inv_num,
        invoice_amt:     shipment.invoice_details?.[0]?.inv_amt,
        picked_at:       shipment.dates?.pickup     ? new Date(shipment.dates.pickup).toISOString()     : null,
        manifested_at:   shipment.dates?.manifested_at ? new Date(shipment.dates.manifested_at).toISOString() : null,
        delivered_at:    shipment.dates?.delivered_at   ? new Date(shipment.dates.delivered_at).toISOString()   : null,
        expected_delivery: shipment.dates?.expected_delivery ? new Date(shipment.dates.expected_delivery).toISOString() : null,
        fallback,
      },
    });

  } catch (err) {
    console.error('[Delhivery B2B] track error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reach Delhivery B2B API', fallback });
  }
});

module.exports = router;
