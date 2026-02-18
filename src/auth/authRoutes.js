// src/auth/authRoutes.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User, HeadOffice, Address, sequelize } = require('../config/database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

const upload = require('../middleware/upload');

// REGISTER
router.post('/register', upload.any(), async (req, res) => {
    try {
        console.log('Register req.body:', req.body);
        console.log('Register req.files:', req.files);

        // Extract files if any
        let legal_documents = {};
        if (req.files && req.files.length > 0) {
            // Logic to handle uploaded files (e.g., upload to Cloudinary)
            // For now, let's assume they are handled or we just store metadata
            req.files.forEach(file => {
                legal_documents[file.fieldname] = file.path || file.originalname;
            });
        }

        const {
            name,
            email,
            password,
            role,
            phone,
            mobileNumber,
            headOffice,
            employeeCode,
            gender,
            salaryType,
            salaryAmount,
            address,
            dateOfBirth,
            dateOfJoining,
            bankDetails,
            emergencyContact,
            reference,
            state,
            headOffices,
            branch,
            department,
            designation,
            employmentType,
            managers,
            areaManagers,
            addressLine1,
            addressLine2,
            landmark,
            pincode,
            postOffice,
            district,
            country
        } = req.body;

        // Parse JSON strings if coming from FormData (multipart)
        const parseJSON = (data) => {
            if (typeof data === 'string') {
                try {
                    return JSON.parse(data);
                } catch (e) {
                    console.error('JSON Parse error:', e);
                    return null;
                }
            }
            return data;
        };

        const parsedBankDetails = parseJSON(bankDetails);
        const parsedEmergencyContact = parseJSON(emergencyContact);
        const parsedReference = parseJSON(reference);
        const parsedHeadOffices = parseJSON(headOffices);
        const parsedManagers = parseJSON(managers);
        const parsedAreaManagers = parseJSON(areaManagers);

        // Validate required fields
        if (!name) return res.status(400).json({ msg: 'Name is required' });
        if (!email) return res.status(400).json({ msg: 'Email is required' });
        if (!password) return res.status(400).json({ msg: 'Password is required' });
        if (!employeeCode) return res.status(400).json({ msg: 'Employee Code is required' });
        if (!gender) return res.status(400).json({ msg: 'Gender is required' });

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Check if employee code already exists
        const existingEmployeeCode = await User.findOne({ where: { employee_code: employeeCode } });
        if (existingEmployeeCode) {
            return res.status(400).json({ msg: 'Employee Code already exists' });
        }

        const validRoles = [
            'Super Admin',
            'Admin',
            'Opps Team',
            'National Head',
            'State Head',
            'Zonal Manager',
            'Area Manager',
            'Manager',
            'User',
            'Accounts',
            'Logistics'
        ];

        if (role && !validRoles.includes(role)) {
            return res.status(400).json({
                msg: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }

        // Initialize transaction
        const transaction = await sequelize.transaction();

        try {
            // Check if structured address is provided
            let addressId = null;
            if (addressLine1 && pincode) {
                const addressPayload = {
                    address_name: name || 'User Address',
                    address_line_1: addressLine1,
                    address_line_2: addressLine2,
                    area_locality: landmark || postOffice || 'N/A',
                    post_office: postOffice || 'N/A',
                    district: district || 'N/A',
                    state: state || 'N/A',
                    pincode: pincode,
                    country: country || 'India',
                    contact_person_name: name,
                    contact_number: mobileNumber || phone || '0000000000',
                    communication_type: 'Home'
                };
                const createdAddress = await Address.create(addressPayload, { transaction });
                addressId = createdAddress.id;
            }

            // Function to check if a string is a UUID
            const isUUID = (str) => {
                return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
            };

            // Create user
            const user = await User.create({
                name,
                email,
                password_hash: password, // Will be hashed by the model hook
                mobile_number: mobileNumber || phone,
                head_office_id: (parsedHeadOffices && parsedHeadOffices.length > 0) ? null : (headOffice && isUUID(headOffice) ? headOffice : null),
                employee_code: employeeCode,
                role,
                gender,
                salary_type: salaryType,
                salary_amount: salaryAmount && !isNaN(salaryAmount) ? parseFloat(salaryAmount) : null,
                address: address || addressLine1, // Compatibility with legacy text address
                address_id: addressId,
                date_of_birth: dateOfBirth ? new Date(dateOfBirth) : null,
                date_of_joining: dateOfJoining ? new Date(dateOfJoining) : null,
                bank_details: parsedBankDetails || {},
                emergency_contact: parsedEmergencyContact || {},
                reference: parsedReference || {},
                state_id: (state && isUUID(state)) ? state : null,
                branch_id: (branch && isUUID(branch)) ? branch : null,
                department_id: (department && isUUID(department)) ? department : null,
                designation_id: (designation && isUUID(designation)) ? designation : null,
                employment_type_id: (employmentType && isUUID(employmentType)) ? employmentType : null,
                legal_documents: legal_documents,
                // Admin-created accounts are automatically email verified
                email_verified: true,
                email_verified_at: new Date()
            }, { transaction });

            // Handle headOffices array if provided
            if (parsedHeadOffices && Array.isArray(parsedHeadOffices) && parsedHeadOffices.length > 0) {
                // Create UserHeadOffice entries for each head office
                const { UserHeadOffice } = require('../config/database');
                const userHeadOfficeRecords = parsedHeadOffices
                    .filter(hoId => hoId && isUUID(hoId))
                    .map(headOfficeId => ({
                        user_id: user.id,
                        head_office_id: headOfficeId
                    }));

                if (userHeadOfficeRecords.length > 0) {
                    await UserHeadOffice.bulkCreate(userHeadOfficeRecords, { transaction });
                }
            }

            // Handle Managers if provided
            if (parsedManagers && Array.isArray(parsedManagers) && parsedManagers.length > 0) {
                const { UserManager } = require('../config/database');
                const managerRecords = parsedManagers
                    .filter(mId => mId && isUUID(mId))
                    .map(managerId => ({
                        user_id: user.id,
                        manager_id: managerId,
                        manager_type: 'manager'
                    }));

                if (managerRecords.length > 0) {
                    await UserManager.bulkCreate(managerRecords, { transaction });
                }
            }

            // Handle Area Managers if provided
            if (parsedAreaManagers && Array.isArray(parsedAreaManagers) && parsedAreaManagers.length > 0) {
                const { UserManager } = require('../config/database');
                const areaManagerRecords = parsedAreaManagers
                    .filter(amId => amId && isUUID(amId))
                    .map(areaManagerId => ({
                        user_id: user.id,
                        manager_id: areaManagerId,
                        manager_type: 'area_manager'
                    }));

                if (areaManagerRecords.length > 0) {
                    await UserManager.bulkCreate(areaManagerRecords, { transaction });
                }
            }

            // Commit transaction
            await transaction.commit();

            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '60h' }
            );

            // Populate headOffices for response
            const populatedUser = await User.findByPk(user.id, {
                include: [
                    {
                        model: HeadOffice,
                        as: 'headOffices',
                        through: { attributes: [] },
                        attributes: ['id', 'name']
                    }
                ]
            });

            // Get all head offices for the user
            let responseHeadOffices = [];
            if (populatedUser && populatedUser.headOffices && populatedUser.headOffices.length > 0) {
                responseHeadOffices = populatedUser.headOffices.map(ho => ({
                    id: ho.id,
                    name: ho.name
                }));
            }

            res.json({
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    headOffices: responseHeadOffices
                }
            });
        } catch (dbError) {
            if (transaction) await transaction.rollback();
            throw dbError;
        }
    } catch (err) {
        console.error('Register error:', err);

        if (err.name === 'SequelizeUniqueConstraintError') {
            const field = err.errors[0].path;
            return res.status(400).json({
                msg: `${field} already exists`
            });
        }

        res.status(500).json({ msg: 'Server error' });
    }
    console.log('Register req.body:', req.body);
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password, device_id, androidId, manufacturer, model } = req.body;

        // Validate input
        if (!email || !password) {
            console.log('Login validation failed:', { email: !!email, password: !!password });
            return res.status(400).json({ msg: 'Email and password are required' });
        }

        if (typeof email !== 'string' || typeof password !== 'string') {
            console.log('Login type validation failed:', {
                emailType: typeof email,
                passwordType: typeof password
            });
            return res.status(400).json({ msg: 'Email and password must be strings' });
        }

        console.log('Login attempt for email:', email);

        // Find user with all assigned head offices
        const user = await User.findOne({
            where: {
                email,
                is_active: true
            },
            include: [
                {
                    model: HeadOffice,
                    as: 'headOffices',
                    through: { attributes: [] }, // Don't include junction table attributes
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!user) {
            console.log('User not found or inactive for email:', email);
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        if (!user.password_hash) {
            console.log('User has no password set:', email);
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        console.log('Comparing passwords for user:', email);
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Password mismatch for user:', email);
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        console.log('✅ Password verified for user:', email, 'Role:', user.role);

        // ============================================
        // DEVICE FINGERPRINTING & BINDING LOGIC
        // ============================================

        // Import device fingerprinting utilities
        const { generateDeviceFingerprint, validateDeviceInfo, getDeviceName } = require('../utils/deviceFingerprint');
        const { UserDevice } = require('../config/database');

        // Check if device info is provided (required for mobile apps)
        if (androidId && manufacturer && model) {
            console.log('📱 Device info provided:', { androidId, manufacturer, model });

            // Validate device info
            if (!validateDeviceInfo({ androidId, manufacturer, model })) {
                return res.status(400).json({
                    success: false,
                    msg: 'Invalid device information provided'
                });
            }

            try {
                // Generate device fingerprint
                const deviceFingerprint = generateDeviceFingerprint(androidId, manufacturer, model);
                const deviceName = getDeviceName(manufacturer, model);

                console.log('🔐 Generated device fingerprint:', deviceFingerprint);

                // Check if this user already has a device registered
                const existingUserDevice = await UserDevice.findOne({
                    where: {
                        user_id: user.id,
                        status: 'ACTIVE'
                    }
                });

                if (existingUserDevice) {
                    // User already has a device - verify fingerprint match
                    console.log('📱 User has existing device binding');

                    if (existingUserDevice.device_fingerprint !== deviceFingerprint) {
                        // Fingerprint mismatch - BLOCK LOGIN
                        console.log('🚫 Device fingerprint mismatch!');
                        console.log('Expected:', existingUserDevice.device_fingerprint);
                        console.log('Received:', deviceFingerprint);

                        return res.status(403).json({
                            success: false,
                            msg: 'Device already registered',
                            error: 'This account is already registered to another device. Please contact your administrator to reset the device binding if you have replaced your tablet or performed a factory reset.',
                            deviceMismatch: true,
                            registeredDevice: {
                                name: existingUserDevice.device_name,
                                lastLogin: existingUserDevice.last_login
                            }
                        });
                    }

                    // Fingerprint matches - allow login and update last_login
                    console.log('✅ Device fingerprint matches - allowing login');
                    await existingUserDevice.update({
                        last_login: new Date()
                    });

                } else {
                    // First login - bind this device to the user
                    console.log('🆕 First login - binding device to user');

                    // Check if this fingerprint is already used by another user
                    const fingerprintInUse = await UserDevice.findOne({
                        where: {
                            device_fingerprint: deviceFingerprint,
                            status: 'ACTIVE'
                        }
                    });

                    if (fingerprintInUse && fingerprintInUse.user_id !== user.id) {
                        console.log('🚫 Device fingerprint already in use by another user');
                        return res.status(403).json({
                            success: false,
                            msg: 'Device already registered to another user',
                            error: 'This device is already registered to another account. Each device can only be used by one user.',
                            deviceInUse: true
                        });
                    }

                    // Create new device binding
                    await UserDevice.create({
                        user_id: user.id,
                        device_id: device_id || androidId, // Use androidId as fallback for device_id
                        android_id: androidId,
                        manufacturer: manufacturer,
                        model: model,
                        device_fingerprint: deviceFingerprint,
                        device_name: deviceName,
                        device_type: 'android',
                        status: 'ACTIVE',
                        last_login: new Date(),
                        is_active: true
                    });

                    console.log('✅ Device bound successfully:', deviceName);
                }

            } catch (deviceError) {
                console.error('❌ Device fingerprinting error:', deviceError);
                return res.status(500).json({
                    success: false,
                    msg: 'Error processing device information',
                    error: deviceError.message
                });
            }

        } else if (device_id) {
            // Legacy device_id provided (backward compatibility)
            console.log('📱 Legacy device_id provided (no fingerprinting):', device_id);

            try {
                const { UserDevice } = require('../config/database');

                // Check if device already exists
                let userDevice = await UserDevice.findOne({
                    where: { device_id }
                });

                if (userDevice) {
                    // Update existing device mapping
                    await userDevice.update({
                        user_id: user.id,
                        last_login: new Date(),
                        is_active: true
                    });
                    console.log('📱 Updated existing device mapping:', device_id, 'for user:', user.id);
                } else {
                    // Create new device mapping
                    await UserDevice.create({
                        user_id: user.id,
                        device_id: device_id,
                        device_type: 'mobile',
                        last_login: new Date(),
                        is_active: true,
                        status: 'ACTIVE'
                    });
                    console.log('📱 Created new device mapping:', device_id, 'for user:', user.id);
                }
            } catch (deviceError) {
                console.error('Device registration error:', deviceError);
                // Don't fail login if device registration fails
            }
        }

        // ============================================
        // GENERATE JWT TOKEN & SEND RESPONSE
        // ============================================

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Get all head offices for the user
        let headOffices = [];

        if (user.headOffices && user.headOffices.length > 0) {
            // User has multiple head offices through many-to-many relationship
            headOffices = user.headOffices.map(ho => ({
                id: ho.id,
                name: ho.name
            }));
        } else if (user.head_office_id) {
            // User has a single head office through foreign key
            const singleHeadOffice = await HeadOffice.findByPk(user.head_office_id, {
                attributes: ['id', 'name']
            });
            if (singleHeadOffice) {
                headOffices = [{
                    id: singleHeadOffice.id,
                    name: singleHeadOffice.name
                }];
            }
        }

        const responseUser = {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: user.email_verified,
            phone: user.mobile_number,
            headOffices: headOffices
        };

        console.log('✅ Login successful - Sending response for user:', responseUser.id);

        res.json({
            token,
            user: responseUser
        });
    } catch (err) {
        console.error('Login error:', err);
        console.error('Login error stack:', err.stack);
        console.error('Request body:', req.body);
        res.status(500).json({ msg: 'Server error during login' });
    }
});


// GENERATE OTP (Email-based)
router.post('/generate-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({ msg: 'Email is required' });

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ msg: 'Invalid email format' });
        }

        // Check if user exists
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Generate OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Log OTP to terminal
        console.log(`Generated OTP for ${email}: ${otp}`);

        // Save OTP and expiration
        await user.update({
            otp: otp,
            otp_expire: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        // Configure Nodemailer
        const transporter = nodemailer.createTransporter({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com',
                pass: process.env.EMAIL_PASS || 'ldgmqixyufjdzylv',
            },
        });

        // Send OTP email
        const mailOptions = {
            from: '"GlucksCare Pharmaceuticals" <gluckscarepharmaceuticals@gmail.com>',
            to: user.email,
            subject: 'Your OTP Code',
            text: `Your OTP code is: ${otp}`,
            html: `<p>Your OTP code is: <strong>${otp}</strong></p><p>It is valid for 10 minutes.</p>`,
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('Email sent:', info.response);
            res.json({ msg: 'OTP sent successfully' });
        } catch (emailError) {
            console.error('Error sending email:', emailError);
            return res.status(500).json({
                msg: 'Failed to send OTP',
                error: emailError.message
            });
        }
    } catch (err) {
        console.error('Generate OTP error:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
});

// VERIFY OTP
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ msg: 'Email and OTP are required' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (user.otp !== otp || user.otp_expire < new Date()) {
            return res.status(400).json({ msg: 'Invalid or expired OTP' });
        }

        await user.update({
            otp: null,
            otp_expire: null,
            email_verified: true,
            email_verified_at: new Date()
        });

        res.json({ msg: 'OTP verified successfully' });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// EMAIL LOGIN (Passwordless)
router.post('/email-login', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                msg: 'Email and OTP are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                msg: 'Invalid email format'
            });
        }

        const user = await User.findOne({
            where: { email },
            include: [
                {
                    model: HeadOffice,
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: 'User not found'
            });
        }

        // Verify OTP
        if (user.otp !== otp || user.otp_expire < new Date()) {
            return res.status(400).json({
                success: false,
                msg: 'Invalid or expired OTP'
            });
        }

        // Check if email is verified
        if (!user.email_verified) {
            return res.status(400).json({
                success: false,
                msg: 'Email not verified. Please verify your email first.'
            });
        }

        // Clear OTP after successful verification
        await user.update({
            otp: null,
            otp_expire: null
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`🚀 Email login successful for ${email}`);

        res.json({
            success: true,
            msg: 'Login successful',
            token,
            user: {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.email_verified,
                employeeCode: user.employee_code,
                headOffices: user.HeadOffice ? [user.HeadOffice] : []
            }
        });
    } catch (err) {
        console.error('Email login error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

// CHECK EMAIL REGISTERED
router.post('/check-email-registered', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({
            success: false,
            msg: 'Email is required'
        });

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({
            success: false,
            msg: 'Invalid email format'
        });

        // Check if user exists
        const user = await User.findOne({
            where: { email },
            attributes: ['email', 'name', 'role', 'email_verified']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: 'Email not registered in the system'
            });
        }

        res.json({
            success: true,
            msg: 'Email is registered',
            data: {
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.email_verified
            }
        });
    } catch (err) {
        console.error('Check email registered error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

// SEND EMAIL OTP
router.post('/send-email-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({
            success: false,
            msg: 'Email is required'
        });

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({
            success: false,
            msg: 'Invalid email format'
        });

        // Check if user exists
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({
            success: false,
            msg: 'Email not registered in the system'
        });

        // Generate OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // Log OTP to terminal for development
        console.log(`🔐 Email Login OTP for ${email}: ${otp}`);

        // Save OTP and expiration
        await user.update({
            otp: otp,
            otp_expire: new Date(Date.now() + 10 * 60 * 1000) // OTP expires in 10 minutes
        });

        // Configure Nodemailer
        const transporter = nodemailer.createTransporter({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.EMAIL_USER || 'gluckscarepharmaceuticals@gmail.com',
                pass: process.env.EMAIL_PASS || 'ldgmqixyufjdzylv',
            },
        });

        // Send OTP email with enhanced template
        const mailOptions = {
            from: '"GlucksCare Pharmaceuticals" <gluckscarepharmaceuticals@gmail.com>',
            to: user.email,
            subject: 'Your Login OTP - GlucksCare Pharmaceuticals',
            text: `Your login OTP code is: ${otp}. It is valid for 10 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://gluckscare.com/logo.png" alt="GlucksCare Pharmaceuticals" style="height: 60px;">
                    </div>
                    <h2 style="color: #c71d51; text-align: center; margin-bottom: 20px;">Login Verification Code</h2>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">Hello ${user.name},</p>
                    <p style="color: #333; font-size: 16px; line-height: 1.6;">Your login verification code is:</p>
                    <div style="background-color: #f8f9fa; border: 2px dashed #c71d51; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
                    <span style="font-size: 32px; font-weight: bold; color: #c71d51; letter-spacing: 3px;">${otp}</span>
                    </div>
                    <p style="color: #666; font-size: 14px; line-height: 1.6;">This code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
                    <p style="color: #666; font-size: 14px; line-height: 1.6;">If you didn't request this code, please ignore this email.</p>
                    <hr style="border: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">© 2025 GlucksCare Pharmaceuticals. All rights reserved.</p>
                </div>
                </div>
            `,
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('📧 Email login OTP sent:', info.response);
            res.json({
                success: true,
                msg: 'OTP sent successfully to your email',
                data: {
                    email: user.email,
                    expiresIn: '10 minutes'
                }
            });
        } catch (emailError) {
            console.error('❌ Error sending email OTP:', emailError);
            return res.status(500).json({
                success: false,
                msg: 'Failed to send OTP email',
                error: emailError.message
            });
        }
    } catch (err) {
        console.error('Send email OTP error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

// VERIFY EMAIL OTP
router.post('/verify-email-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) return res.status(400).json({
            success: false,
            msg: 'Email and OTP are required'
        });

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({
            success: false,
            msg: 'Invalid email format'
        });

        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({
            success: false,
            msg: 'User not found'
        });

        if (user.otp !== otp || user.otp_expire < new Date()) {
            return res.status(400).json({
                success: false,
                msg: 'Invalid or expired OTP'
            });
        }

        // Clear OTP and mark email as verified
        await user.update({
            otp: null,
            otp_expire: null,
            email_verified: true,
            email_verified_at: new Date()
        });

        console.log(`✅ Email OTP verified for ${email}`);

        res.json({
            success: true,
            msg: 'OTP verified successfully',
            data: {
                email: user.email,
                emailVerified: true
            }
        });
    } catch (err) {
        console.error('Verify email OTP error:', err);
        res.status(500).json({
            success: false,
            msg: 'Server error',
            error: err.message
        });
    }
});

// GET CURRENT USER
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [
                {
                    model: HeadOffice,
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                employeeCode: user.employee_code,
                emailVerified: user.email_verified,
                headOffices: user.HeadOffice ? [user.HeadOffice] : []
            }
        });
    } catch (err) {
        console.error('Get current user error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;