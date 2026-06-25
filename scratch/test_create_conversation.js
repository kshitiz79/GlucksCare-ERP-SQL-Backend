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

    const convId = "5e79b954-f9c2-4975-b9fe-dc2ff7d5dd45"; // atif khan conversation
    console.log(`\n--- Fetching Messages for Conversation ${convId} ---`);
    const msgRes = await fetch(`${WA_BASE}/messages/${convId}?page=0&size=30`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('Messages HTTP Status:', msgRes.status);
    const msgJson = await msgRes.json();
    console.log('Messages Response:', JSON.stringify(msgJson, null, 2));

    console.log(`\n--- Sending Message to Conversation ${convId} ---`);
    const sendRes = await fetch(`${WA_BASE}/messages/${convId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        type: 'TEXT',
        text: 'Hello from Antigravity automation script!'
      })
    });
    console.log('Send Message HTTP Status:', sendRes.status);
    const sendJson = await sendRes.json();
    console.log('Send Message Response:', JSON.stringify(sendJson, null, 2));

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
