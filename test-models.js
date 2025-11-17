// Quick test to check if models are exported
const { Advance, AdvanceRepayment, User } = require('./src/config/database');

console.log('Advance model:', Advance ? '✅ Found' : '❌ Not found');
console.log('AdvanceRepayment model:', AdvanceRepayment ? '✅ Found' : '❌ Not found');
console.log('User model:', User ? '✅ Found' : '❌ Not found');

if (Advance) {
  console.log('\nAdvance associations:', Object.keys(Advance.associations || {}));
}

if (User) {
  console.log('User associations:', Object.keys(User.associations || {}));
}

process.exit(0);
