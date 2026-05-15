// src/delhivery/delhiveryRoutes.js
// Server-side proxy for Delhivery API — avoids CORS on frontend
// React → This backend → Delhivery API

const express = require('express');
const https = require('https');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');

const DELHIVERY_TOKEN    = process.env.DELHIVERY_API_TOKEN;
const DELHIVERY_BASE     = 'track.delhivery.com';
const PICKUP_LOCATION    = process.env.DELHIVERY_PICKUP_LOCATION || '';

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
    },
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
//   weight_kg    — total shipment weight in kg
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
  const cgm = Math.round(weightNum * 1000); // kg → grams (dead weight)

  // Volumetric weight in grams: vol_cm3 / divisor(5000) * 1000
  // Delhivery uses whichever is higher: dead weight vs volumetric weight
  // We pass both and let Delhivery decide via cgm (it picks max internally)
  let volParam = '';
  if (vol_cm3 && parseFloat(vol_cm3) > 0) {
    volParam = `&vol=${Math.round(parseFloat(vol_cm3))}`;
  }

  try {
    let path = `/api/kinko/v1/invoice/charges/.json?md=${md}&ss=${ss}&d_pin=${d_pin}&o_pin=${o_pin}&cgm=${cgm}${volParam}`;
    if (payment_mode === 'COD' && cod_amount && parseFloat(cod_amount) > 0) {
      path += `&cod=${cod_amount}`;
    }

    console.log('[Delhivery] b2b-freight path:', path);
    const { status, body } = await delhiveryGet(path);

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
    pickup_location = PICKUP_LOCATION || 'Warehouse1',
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
    pickup_location,
  };

  // Delhivery requires form-encoded: format=json&data=<JSON string>
  const formBody = `format=json&data=${encodeURIComponent(JSON.stringify(shipmentPayload))}`;

  try {
    console.log('[Delhivery] create-shipment payload:', JSON.stringify(shipmentPayload, null, 2));
    const { status, body } = await delhiveryPost('/api/cmu/create.json', formBody);

    console.log('[Delhivery] create-shipment response:', status, JSON.stringify(body));

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
//
// Supports BOTH:
//   - B2C Express waybill (13-digit, e.g. 1234567890123)
//   - B2B LR number (9-digit, e.g. 304109647)
//
// NOTE: B2B LR numbers are NOT accessible via the Express API token.
// For B2B, we return the public Delhivery tracking URL so the user
// can open it directly. For B2C, we return full JSON tracking data.
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
// Get shipping label / packing slip URL for a waybill
// Returns the label as a redirect to Delhivery's PDF URL
// ─────────────────────────────────────────────────────────────────────────────
router.get('/label/:waybill', authMiddleware, async (req, res) => {
  const { waybill } = req.params;

  if (!waybill || waybill.trim().length < 5) {
    return res.status(400).json({ success: false, message: 'Invalid waybill number' });
  }

  try {
    // First verify the waybill exists via tracking
    const { status, body } = await delhiveryGet(
      `/api/p/packing_slip?wbns=${encodeURIComponent(waybill.trim())}&token=${DELHIVERY_TOKEN}`
    );

    console.log('[Delhivery] label response:', status, JSON.stringify(body).slice(0, 300));

    if (status !== 200) {
      return res.status(status).json({ success: false, message: 'Label not available' });
    }

    // If packages_found is 0, waybill doesn't exist
    if (body.packages_found === 0 || (Array.isArray(body.packages) && body.packages.length === 0)) {
      return res.json({
        success: false,
        message: 'No label found for this waybill. Ensure the shipment was created successfully.',
      });
    }

    // Return the label URL for the frontend to open
    const labelUrl = `https://track.delhivery.com/api/p/packing_slip?wbns=${waybill.trim()}&token=${DELHIVERY_TOKEN}`;

    return res.json({
      success: true,
      data: {
        waybill,
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
// GET /api/delhivery/b2b-track
// Track a B2B LTL shipment by LR number
//
// Uses Delhivery One internal API (discovered via Network tab):
//   POST https://ucp-egw.delhivery.com/101/api/v1/lrn/shipment/list
//
// Token is a short-lived JWT from one.delhivery.com (expires ~10 min).
// When expired, backend returns token_expired:true so frontend can prompt user.
// ─────────────────────────────────────────────────────────────────────────────
const DELHIVERY_B2B_TOKEN     = process.env.DELHIVERY_B2B_TOKEN;
const DELHIVERY_B2B_CLIENT_ID = process.env.DELHIVERY_B2B_CLIENT_ID || '';
const DELHIVERY_UCP_HOST      = 'ucp-egw.delhivery.com';
const DELHIVERY_UCP_PATH      = '/101/api/v1/lrn/shipment/list';

// Helper: POST to Delhivery UCP gateway
const delhiveryB2BPost = (body) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: DELHIVERY_UCP_HOST,
      path:     DELHIVERY_UCP_PATH,
      method:   'POST',
      headers: {
        Authorization:    `Bearer ${DELHIVERY_B2B_TOKEN}`,
        'Content-Type':   'application/json',
        Accept:           'application/json, text/plain, */*',
        'x-hq-client-id': DELHIVERY_B2B_CLIENT_ID,
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

  if (!DELHIVERY_B2B_TOKEN) {
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

    // JWT expired
    if (status === 401 || (body?.statusCode === 401) || (body?.statusCode === 403)) {
      return res.json({
        success: false, token_expired: true,
        message: 'B2B token expired. Get a fresh token from one.delhivery.com Network tab and update DELHIVERY_B2B_TOKEN in .env',
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
