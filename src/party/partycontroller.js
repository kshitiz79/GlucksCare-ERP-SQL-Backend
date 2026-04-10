const { Doctor, Stockist, Chemist, User, Address } = require('../config/database');

exports.getAllParties = async (req, res) => {
    try {
        console.log('--- Party Search API Called ---');

        // 1. Doctors
        let formattedDoctors = [];
        try {
            const doctors = await Doctor.findAll({
                attributes: ['id', 'name', ['clinic_address', 'address'], ['phone', 'mobile']],
                raw: true
            });
            formattedDoctors = doctors.map(d => ({ ...d, type: 'Doctor' }));
            console.log(`✅ Doctors: ${formattedDoctors.length}`);
        } catch (err) {
            console.error('❌ Error fetching Doctors:', err.message);
        }

        // 2. Stockists
        let formattedStockists = [];
        try {
            const stockists = await Stockist.findAll({
                attributes: ['id', ['firm_name', 'name'], ['registered_office_address', 'address'], ['mobile_number', 'mobile']],
                raw: true
            });
            formattedStockists = stockists.map(s => ({ ...s, type: 'Stockist' }));
            console.log(`✅ Stockists: ${formattedStockists.length}`);
        } catch (err) {
            console.error('❌ Error fetching Stockists:', err.message);
        }

        // 3. Chemists
        let formattedChemists = [];
        try {
            const chemists = await Chemist.findAll({
                attributes: ['id', ['firm_name', 'name'], 'address', ['mobile_no', 'mobile']],
                raw: true
            });
            formattedChemists = chemists.map(c => ({ ...c, type: 'Chemist' }));
            console.log(`✅ Chemists: ${formattedChemists.length}`);
        } catch (err) {
            console.error('❌ Error fetching Chemists:', err.message);
        }

        // 4. Users (Employees)
        let formattedUsers = [];
        try {
            const users = await User.findAll({
                attributes: ['id', 'name', ['mobile_number', 'mobile']],
                include: [{
                    model: Address,
                    as: 'masterAddress',
                    required: false,
                    attributes: ['address_line_1', 'address_line_2', 'area_locality', 'district', 'state', 'pincode']
                }]
            });
            
            formattedUsers = users.map(u => {
                const userData = u.get({ plain: true });
                const addr = userData.masterAddress;
                
                let addressString = '';
                if (addr) {
                    addressString = [
                        addr.address_line_1,
                        addr.address_line_2,
                        addr.area_locality,
                        addr.district,
                        addr.state,
                        addr.pincode
                    ].filter(Boolean).join(', ');
                }

                return {
                    id: userData.id,
                    name: userData.name,
                    address: addressString,
                    mobile: userData.mobile || '',
                    type: 'User'
                };
            });
            console.log(`✅ Users: ${formattedUsers.length}`);
        } catch (err) {
            console.error('❌ Error fetching Users:', err.message);
        }

        const allParties = [
            ...formattedDoctors,
            ...formattedStockists,
            ...formattedChemists,
            ...formattedUsers
        ];

        console.log(`🚀 Total Parties Found: ${allParties.length}`);

        return res.status(200).json({
            success: true,
            count: allParties.length,
            data: allParties
        });

    } catch (error) {
        console.error('🔥 Global Party Controller Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching parties',
            error: error.message
        });
    }
};
