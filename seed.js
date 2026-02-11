// seed.js
const { sequelize, User, State, HeadOffice, Branch, Department, Designation, EmploymentType } = require('./src/config/database');

async function seed() {
    try {
        console.log('🌱 Starting database seeding...');

        // Synchronize models with database (force: false won't drop tables)
        await sequelize.sync({ force: false });
        console.log('✅ Tables synchronized.');

        // 1. Create Default State
        const [state] = await State.findOrCreate({
            where: { code: 'UP' },
            defaults: {
                name: 'Uttar Pradesh',
                country: 'India',
                is_active: true
            }
        });
        console.log(`📍 State created/found: ${state.name}`);

        // 2. Create Default Head Office
        const [headOffice] = await HeadOffice.findOrCreate({
            where: { name: 'Noida Head Office' },
            defaults: {
                stateId: state.id,
                pincode: '201301',
                is_active: true
            }
        });
        console.log(`🏢 Head Office created/found: ${headOffice.name}`);

        // 3. Create Default Department
        const [department] = await Department.findOrCreate({
            where: { name: 'Administration' },
            defaults: {
                code: 'ADMIN',
                is_active: true
            }
        });
        console.log(`📂 Department created/found: ${department.name}`);

        // 4. Create Default Designation
        const [designation] = await Designation.findOrCreate({
            where: { name: 'System Administrator' },
            defaults: { is_active: true }
        });
        console.log(`👨‍💼 Designation created/found: ${designation.name}`);

        // 5. Create Super Admin User
        const adminEmail = 'admin1@gluckscare.com';
        const [admin, created] = await User.findOrCreate({
            where: { email: adminEmail },
            defaults: {
                employee_code: 'GPPL/ADMIN/002',
                name: 'Admin',
                password_hash: 'Admin@123', // This will be hashed by the model hook
                mobile_number: '9999999999',
                gender: 'Male',
                role: 'Admin',
                head_office_id: headOffice.id,
                state_id: state.id,
                department_id: department.id,
                designation_id: designation.id,
                is_active: true,
                email_verified: true,
                email_verified_at: new Date()
            }
        });

        if (created) {
            console.log(`👤 Super Admin created successfully: ${adminEmail}`);
        } else {
            console.log(`👤 Super Admin already exists: ${adminEmail}`);
        }

        console.log('\n✨ Seeding completed successfully!');
        console.log('-----------------------------------');
        console.log(`Login Email: ${adminEmail}`);
        console.log('Login Password: Admin@123');
        console.log('-----------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

seed();
