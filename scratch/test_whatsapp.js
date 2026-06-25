const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../Fontend/.env') });

const WA_BASE = process.env.VITE_WHATSAPP_API_URL || 'https://whatsapptools.rbshtools.cloud';
const WA_API_KEY = process.env.VITE_WHATSAPP_API_KEY || '';
const WA_EMAIL = process.env.VITE_WHATSAPP_EMAIL || 'gluckscarepharmaceuticals@gmail.com';
const WA_PASSWORD = process.env.VITE_WHATSAPP_PASSWORD || '*Gluckscare9217331252';

async function run() {
  try {
    const loginRes = await fetch(`${WA_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WA_API_KEY
      },
      body: JSON.stringify({ email: WA_EMAIL, password: WA_PASSWORD })
    });

    const loginJson = await loginRes.json();
    const token = loginJson?.data?.token || loginJson?.token;
    if (!token) return;

    console.log('\n--- Raw Customers Response ---');
    const custRes = await fetch(`${WA_BASE}/customers?page=0&size=2`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(await custRes.json());

    console.log('\n--- Raw Conversations Response ---');
    const convRes = await fetch(`${WA_BASE}/conversations?page=0&size=2`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(await convRes.json());

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
