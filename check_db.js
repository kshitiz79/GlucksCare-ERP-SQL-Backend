const { InventoryItem, Product } = require('./src/config/database');

async function check() {
  const inv = await InventoryItem.findAll();
  console.log('--- INVENTORY ITEMS ---');
  console.log(JSON.stringify(inv, null, 2));

  const prod = await Product.findAll();
  console.log('--- PRODUCT MASTER ---');
  console.log(JSON.stringify(prod, null, 2));

  process.exit();
}

check();
