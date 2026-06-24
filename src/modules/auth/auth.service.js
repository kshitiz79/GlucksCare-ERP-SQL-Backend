// src/modules/auth/auth.service.js

const AuthRepository = require('./auth.repository');
const JwtService = require('../../services/jwt.service');
const OtpService = require('../../services/otp.service');
const UserRepository = require('../../repositories/user.repository');
const { validRoles } = require('../../constants/roles');
const { sequelize, HeadOffice } = require('../../config/database');

const isUUID = (str) => {
    if (!str || typeof str !== 'string' || str.trim() === '') return false;
    const simpleRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return simpleRegex.test(str);
};

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

class AuthService {
    static async register(body, files) {
        console.log('Register req.body:', body);
        console.log('Register req.files:', files);

        // Extract files if any
        let legal_documents = {};
        if (files && files.length > 0) {
            files.forEach(file => {
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
        } = body;

        const parsedBankDetails = parseJSON(bankDetails);
        const parsedEmergencyContact = parseJSON(emergencyContact);
        const parsedReference = parseJSON(reference);
        const parsedHeadOffices = parseJSON(headOffices);
        const parsedManagers = parseJSON(managers);
        const parsedAreaManagers = parseJSON(areaManagers);

        // Validate required fields
        if (!name) throw { statusCode: 400, message: 'Name is required' };
        if (!email) throw { statusCode: 400, message: 'Email is required' };
        if (!password) throw { statusCode: 400, message: 'Password is required' };
        if (!employeeCode) throw { statusCode: 400, message: 'Employee Code is required' };
        if (!gender) throw { statusCode: 400, message: 'Gender is required' };

        // Check if user already exists
        const existingUser = await AuthRepository.findUserByEmail(email);
        if (existingUser) {
            throw { statusCode: 400, message: 'User already exists' };
        }

        // Check if employee code already exists
        const existingEmployeeCode = await AuthRepository.findUserByEmployeeCode(employeeCode);
        if (existingEmployeeCode) {
            throw { statusCode: 400, message: 'Employee Code already exists' };
        }

        if (role && !validRoles.includes(role)) {
            throw {
                statusCode: 400,
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            };
        }

        // Initialize transaction
        const transaction = await sequelize.transaction();

        try {
            // Check if structured address is provided
            let addressId = null;
            if (addressLine1 && pincode) {
                console.log('Creating structured address...');
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
                const createdAddress = await AuthRepository.createAddress(addressPayload, transaction);
                addressId = createdAddress.id;
                console.log('✅ Structured address created with ID:', addressId);
            }

            console.log('Creating User record...');
            // Create user
            const user = await AuthRepository.createUser({
                name,
                email,
                password_hash: password, // Will be hashed by the model hook
                mobile_number: mobileNumber || phone,
                head_office_id: (parsedHeadOffices && parsedHeadOffices.length > 0) ? null : (headOffice && isUUID(headOffice) ? headOffice : null),
                employee_code: employeeCode,
                role,
                gender,
                salary_type: salaryType,
                salary_amount: (salaryAmount && !isNaN(salaryAmount) && salaryAmount.toString().trim() !== '') ? parseFloat(salaryAmount) : null,
                address: address || addressLine1,
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
                email_verified: true,
                email_verified_at: new Date()
            }, transaction);

            console.log('✅ User record created with ID:', user.id);

            // Handle headOffices array if provided
            if (parsedHeadOffices && Array.isArray(parsedHeadOffices) && parsedHeadOffices.length > 0) {
                const userHeadOfficeRecords = parsedHeadOffices
                    .filter(hoId => hoId && isUUID(hoId))
                    .map(headOfficeId => ({
                        user_id: user.id,
                        head_office_id: headOfficeId
                    }));

                if (userHeadOfficeRecords.length > 0) {
                    await AuthRepository.bulkCreateUserHeadOffices(userHeadOfficeRecords, transaction);
                }
            }

            // Handle Managers if provided
            if (parsedManagers && Array.isArray(parsedManagers) && parsedManagers.length > 0) {
                const managerRecords = parsedManagers
                    .filter(mId => mId && isUUID(mId))
                    .map(managerId => ({
                        user_id: user.id,
                        manager_id: managerId,
                        manager_type: 'manager'
                    }));

                if (managerRecords.length > 0) {
                    await AuthRepository.bulkCreateUserManagers(managerRecords, transaction);
                }
            }

            // Handle Area Managers if provided
            if (parsedAreaManagers && Array.isArray(parsedAreaManagers) && parsedAreaManagers.length > 0) {
                const areaManagerRecords = parsedAreaManagers
                    .filter(amId => amId && isUUID(amId))
                    .map(areaManagerId => ({
                        user_id: user.id,
                        manager_id: areaManagerId,
                        manager_type: 'area_manager'
                    }));

                if (areaManagerRecords.length > 0) {
                    await AuthRepository.bulkCreateUserManagers(areaManagerRecords, transaction);
                }
            }

            await transaction.commit();
            console.log('✅ Transaction committed successfully');

            const token = JwtService.generateToken({ id: user.id, role: user.role }, '60h');

            const populatedUser = await AuthRepository.findUserById(user.id, {
                include: [
                    {
                        model: HeadOffice,
                        as: 'headOffices',
                        through: { attributes: [] },
                        attributes: ['id', 'name']
                    }
                ]
            });

            let responseHeadOffices = [];
            if (populatedUser && populatedUser.headOffices && populatedUser.headOffices.length > 0) {
                responseHeadOffices = populatedUser.headOffices.map(ho => ({
                    id: ho.id,
                    name: ho.name
                }));
            }

            return {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    headOffices: responseHeadOffices
                }
            };
        } catch (dbError) {
            console.error('❌ Database/Internal Error during registration:', dbError);
            if (transaction) {
                await transaction.rollback();
            }
            throw dbError;
        }
    }

    static async login(body) {
        const { email, password, device_id, androidId, manufacturer, model } = body;

        if (!email || !password) {
            throw { statusCode: 400, message: 'Email and password are required' };
        }

        if (typeof email !== 'string' || typeof password !== 'string') {
            throw { statusCode: 400, message: 'Email and password must be strings' };
        }

        console.log('Login attempt for email:', email);

        const user = await AuthRepository.findUserByEmailActive(email, true);

        if (!user || !user.password_hash) {
            console.log('User not found or inactive, or no password set for:', email);
            throw { statusCode: 400, message: 'Invalid credentials' };
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('Password mismatch for user:', email);
            throw { statusCode: 400, message: 'Invalid credentials' };
        }

        console.log('✅ Password verified for user:', email, 'Role:', user.role);

        // DEVICE FINGERPRINTING & BINDING LOGIC
        const { generateDeviceFingerprint, validateDeviceInfo, getDeviceName } = require('../../utils/deviceFingerprint');

        if (androidId && manufacturer && model) {
            console.log('📱 Device info provided:', { androidId, manufacturer, model });

            if (!validateDeviceInfo({ androidId, manufacturer, model })) {
                throw { statusCode: 400, message: 'Invalid device information provided' };
            }

            const deviceFingerprint = generateDeviceFingerprint(androidId, manufacturer, model);
            const deviceName = getDeviceName(manufacturer, model);

            console.log('🔐 Generated device fingerprint:', deviceFingerprint);

            const existingUserDevice = await AuthRepository.findActiveUserDevice(user.id);

            if (existingUserDevice) {
                console.log('📱 User has existing device binding');

                if (existingUserDevice.device_fingerprint !== deviceFingerprint) {
                    console.log('🚫 Device fingerprint mismatch!');
                    throw {
                        statusCode: 403,
                        deviceMismatch: true,
                        message: 'Device already registered',
                        error: 'This account is already registered to another device. Please contact your administrator to reset the device binding if you have replaced your tablet or performed a factory reset.',
                        registeredDevice: {
                            name: existingUserDevice.device_name,
                            lastLogin: existingUserDevice.last_login
                        }
                    };
                }

                console.log('✅ Device fingerprint matches - allowing login');
                await existingUserDevice.update({
                    last_login: new Date()
                });
            } else {
                console.log('🆕 First login - binding device to user');

                const fingerprintInUse = await AuthRepository.findActiveDeviceByFingerprint(deviceFingerprint);

                if (fingerprintInUse && fingerprintInUse.user_id !== user.id) {
                    console.log('🚫 Device fingerprint already in use by another user');
                    throw {
                        statusCode: 403,
                        deviceInUse: true,
                        message: 'Device already registered to another user',
                        error: 'This device is already registered to another account. Each device can only be used by one user.'
                    };
                }

                await AuthRepository.createDevice({
                    user_id: user.id,
                    device_id: device_id || androidId,
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
        } else if (device_id) {
            console.log('📱 Legacy device_id provided (no fingerprinting):', device_id);

            try {
                let userDevice = await AuthRepository.findDeviceById(device_id);

                if (userDevice) {
                    await userDevice.update({
                        user_id: user.id,
                        last_login: new Date(),
                        is_active: true
                    });
                    console.log('📱 Updated existing device mapping:', device_id, 'for user:', user.id);
                } else {
                    await AuthRepository.createDevice({
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
            }
        }

        const token = JwtService.generateToken({ id: user.id, role: user.role }, '7d');

        let headOffices = [];

        if (user.headOffices && user.headOffices.length > 0) {
            headOffices = user.headOffices.map(ho => ({
                id: ho.id,
                name: ho.name
            }));
        } else if (user.head_office_id) {
            const singleHeadOffice = await AuthRepository.findHeadOfficeById(user.head_office_id, {
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

        return {
            token,
            user: responseUser
        };
    }

    static async generateOtp(email) {
        if (!email) throw { statusCode: 400, message: 'Email is required' };

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw { statusCode: 400, message: 'Invalid email format' };
        }

        const user = await AuthRepository.findUserByEmail(email);
        if (!user) throw { statusCode: 404, message: 'User not found' };

        const otp = OtpService.generateOtp();

        console.log(`Generated OTP for ${email}: ${otp}`);

        await user.update({
            otp: otp,
            otp_expire: new Date(Date.now() + 10 * 60 * 1000)
        });

        try {
            await OtpService.sendOtpEmail(user.email, user.name, otp);
            return { msg: 'OTP sent successfully' };
        } catch (emailError) {
            console.error('Error sending email:', emailError);
            throw {
                statusCode: 500,
                message: 'Failed to send OTP',
                error: emailError.message
            };
        }
    }

    static async verifyOtp(email, otp) {
        if (!email || !otp) {
            throw { statusCode: 400, message: 'Email and OTP are required' };
        }

        const user = await AuthRepository.findUserByEmail(email);
        if (!user) throw { statusCode: 404, message: 'User not found' };

        if (user.otp !== otp || user.otp_expire < new Date()) {
            throw { statusCode: 400, message: 'Invalid or expired OTP' };
        }

        await UserRepository.clearOtpAndVerifyEmail(user.id);

        return { msg: 'OTP verified successfully' };
    }

    static async emailLogin(email, otp) {
        if (!email || !otp) {
            throw { statusCode: 400, message: 'Email and OTP are required' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw { statusCode: 400, message: 'Invalid email format' };
        }

        const user = await AuthRepository.findUserByEmail(email, {
            include: [
                {
                    model: HeadOffice,
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!user) throw { statusCode: 404, message: 'User not found' };

        if (user.otp !== otp || user.otp_expire < new Date()) {
            throw { statusCode: 400, message: 'Invalid or expired OTP' };
        }

        if (!user.email_verified) {
            throw { statusCode: 400, message: 'Email not verified. Please verify your email first.' };
        }

        await user.update({
            otp: null,
            otp_expire: null
        });

        const token = JwtService.generateToken({ id: user.id, role: user.role }, '7d');

        console.log(`🚀 Email login successful for ${email}`);

        return {
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
        };
    }

    static async checkEmailRegistered(email) {
        if (!email) throw { statusCode: 400, message: 'Email is required' };

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw { statusCode: 400, message: 'Invalid email format' };
        }

        const user = await AuthRepository.findUserByEmail(email, {
            attributes: ['email', 'name', 'role', 'email_verified']
        });

        if (!user) {
            throw { statusCode: 404, message: 'Email not registered in the system' };
        }

        return {
            success: true,
            msg: 'Email is registered',
            data: {
                email: user.email,
                name: user.name,
                role: user.role,
                emailVerified: user.email_verified
            }
        };
    }

    static async sendEmailOtp(email) {
        if (!email) throw { statusCode: 400, message: 'Email is required' };

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw { statusCode: 400, message: 'Invalid email format' };
        }

        const user = await AuthRepository.findUserByEmail(email);
        if (!user) throw { statusCode: 404, message: 'Email not registered in the system' };

        const otp = OtpService.generateOtp();

        console.log(`🔐 Email Login OTP for ${email}: ${otp}`);

        await user.update({
            otp: otp,
            otp_expire: new Date(Date.now() + 10 * 60 * 1000)
        });

        try {
            await OtpService.sendEnhancedOtpEmail(user.email, user.name, otp);
            return {
                success: true,
                msg: 'OTP sent successfully to your email',
                data: {
                    email: user.email,
                    expiresIn: '10 minutes'
                }
            };
        } catch (emailError) {
            console.error('❌ Error sending email OTP:', emailError);
            throw {
                statusCode: 500,
                message: 'Failed to send OTP email',
                error: emailError.message
            };
        }
    }

    static async verifyEmailOtp(email, otp) {
        if (!email || !otp) {
            throw { statusCode: 400, message: 'Email and OTP are required' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw { statusCode: 400, message: 'Invalid email format' };
        }

        const user = await AuthRepository.findUserByEmail(email);
        if (!user) throw { statusCode: 404, message: 'User not found' };

        if (user.otp !== otp || user.otp_expire < new Date()) {
            throw { statusCode: 400, message: 'Invalid or expired OTP' };
        }

        await UserRepository.clearOtpAndVerifyEmail(user.id);

        console.log(`✅ Email OTP verified for ${email}`);

        return {
            success: true,
            msg: 'OTP verified successfully',
            data: {
                email: user.email,
                emailVerified: true
            }
        };
    }

    static async me(userId) {
        const user = await AuthRepository.findUserById(userId, {
            include: [
                {
                    model: HeadOffice,
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!user) throw { statusCode: 404, message: 'User not found' };

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                employeeCode: user.employee_code,
                emailVerified: user.email_verified,
                headOffices: user.HeadOffice ? [user.HeadOffice] : []
            }
        };
    }
}

module.exports = AuthService;
