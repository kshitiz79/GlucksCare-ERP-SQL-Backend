// resetPassword.js
const { sequelize, User } = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function reset() {
    try {
        const emails = ['admin@gluckscare.com', 'admin1@gluckscare.com'];
        const newPassword = 'Admin@123';

        console.log('🔄 Resetting passwords...');

        for (const email of emails) {
            const user = await User.findOne({ where: { email } });
            if (user) {
                console.log(`Found user: ${email}. Updating password...`);
                // We manually hash here to be 100% sure, or just update the field and let the hook handle it.
                // To be safe, let's let the hook handle it but use .save() which triggers beforeUpdate.
                user.password_hash = newPassword;
                await user.save();
                console.log(`✅ Password reset for ${email}`);
            } else {
                console.log(`❌ User not found: ${email}`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Reset failed:', error);
        process.exit(1);
    }
}

reset();
