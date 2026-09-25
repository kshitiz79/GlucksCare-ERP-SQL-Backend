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

const getUserAssignedHeadOffices = async (user, targetModels = null) => {
    if (!user) return [];
    const models = targetModels || require('../../config/database');
    const { HeadOffice, UserHeadOffice } = models;
    const officeIds = new Set();

    if (user.head_office_id) {
        officeIds.add(user.head_office_id);
    }

    if (UserHeadOffice) {
        const userOffices = await UserHeadOffice.findAll({
            where: { user_id: user.id },
            attributes: ['head_office_id'],
            raw: true
        }).catch(() => []);
        userOffices.forEach(uo => {
            if (uo.head_office_id) officeIds.add(uo.head_office_id);
        });
    }

    if (user.headOffices && Array.isArray(user.headOffices)) {
        user.headOffices.forEach(ho => {
            if (ho.id) officeIds.add(ho.id);
        });
    }

    if (officeIds.size === 0) return [];

    const { Op } = require('sequelize');
    const offices = await HeadOffice.findAll({
        where: {
            id: { [Op.in]: Array.from(officeIds) }
        },
        attributes: ['id', 'name', 'latitude', 'longitude', 'pincode', 'state_id'],
        raw: true
    }).catch(() => []);

    return offices.map(ho => ({
        id: ho.id,
        name: ho.name,
        latitude: ho.latitude ? Number(ho.latitude) : 0,
        longitude: ho.longitude ? Number(ho.longitude) : 0,
        pincode: ho.pincode || null,
        state_id: ho.state_id || null
    }));
};

const resolveCompanyData = async (tenantContext = null, targetModels = null) => {
    let companySetting = null;
    try {
        const models = targetModels || require('../../config/database');
        if (models && models.CompanySetting) {
            companySetting = await models.CompanySetting.findOne({
                order: [['id', 'ASC']]
            });
        }
    } catch (e) {
        console.error('Error fetching CompanySetting in auth service:', e);
    }

    const id = tenantContext?.id ? tenantContext.id.toString() : (companySetting?.id ? companySetting.id.toString() : 'main');
    const companyName = companySetting?.companyName || tenantContext?.name || 'Zenith Healthcare Ltd';
    const slug = tenantContext?.slug || (companySetting?.companyName ? companySetting.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'zenith');
    const logoUrl = companySetting?.logoUrl || tenantContext?.logo_url || 'https://example.com/logo.png';
    const backendUrl = tenantContext?.backend_url || process.env.API_BASE_URL || 'https://api.gluckscare.com';
    const subdomain = tenantContext?.subdomain || (slug ? `${slug}.gluckscare.com` : 'zenith.gluckscare.com');
    const status = tenantContext?.status || 'ACTIVE';

    return {
        id,
        companyName,
        slug,
        logoUrl,
        backendUrl,
        subdomain,
        status
    };
};

class AuthService {
    static async register(body, files, req = null) {
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

        if (role && !validRoles.includes(role)) {
            throw {
                statusCode: 400,
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            };
        }

        // 1. Resolve Multi-tenant DB Context
        const { resolveTenantByEmail, resolveTenantFromRequest } = require('../../platform/tenantConnectionManager');
        let targetDbModels = null;
        let tenantContext = null;

        if (req && req.db) {
            targetDbModels = req.db;
            tenantContext = req.tenant;
        } else if (req) {
            const reqTenantResult = await resolveTenantFromRequest(req);
            if (reqTenantResult) {
                tenantContext = reqTenantResult.tenant;
                targetDbModels = reqTenantResult.db.models;
            }
        }

        if (!targetDbModels && email) {
            const emailTenantResult = await resolveTenantByEmail(email).catch(() => null);
            if (emailTenantResult) {
                tenantContext = emailTenantResult.tenant;
                targetDbModels = emailTenantResult.db.models;
            }
        }

        const models = targetDbModels || require('../../config/database');

        // 2. Check if user or employee code already exists in target DB
        const existingUser = await models.User.findOne({
            where: { email: email.toLowerCase().trim() }
        });
        if (existingUser) {
            throw { statusCode: 400, message: 'User already exists' };
        }

        const existingEmployeeCode = await models.User.findOne({
            where: { employee_code: employeeCode.trim() }
        });
        if (existingEmployeeCode) {
            throw { statusCode: 400, message: 'Employee Code already exists' };
        }

        // 3. Foreign Key Validation & Sanitization (prevents ForeignKeyConstraintError)
        let validBranchId = null;
        if (branch && isUUID(branch) && models.Branch) {
            const b = await models.Branch.findByPk(branch).catch(() => null);
            if (b) validBranchId = branch;
        }

        let validDepartmentId = null;
        if (department && isUUID(department) && models.Department) {
            const d = await models.Department.findByPk(department).catch(() => null);
            if (d) validDepartmentId = department;
        }

        let validDesignationId = null;
        if (designation && isUUID(designation) && models.Designation) {
            const des = await models.Designation.findByPk(designation).catch(() => null);
            if (des) validDesignationId = designation;
        }

        let validEmploymentTypeId = null;
        if (employmentType && isUUID(employmentType) && models.EmploymentType) {
            const et = await models.EmploymentType.findByPk(employmentType).catch(() => null);
            if (et) validEmploymentTypeId = employmentType;
        }

        let validStateId = null;
        if (state && isUUID(state) && models.State) {
            const s = await models.State.findByPk(state).catch(() => null);
            if (s) validStateId = state;
        }

        let validHeadOfficeId = null;
        if (headOffice && isUUID(headOffice) && models.HeadOffice) {
            const ho = await models.HeadOffice.findByPk(headOffice).catch(() => null);
            if (ho) validHeadOfficeId = headOffice;
        }

        // Initialize transaction on the correct DB connection
        const activeSequelize = (models.User && models.User.sequelize) || models.sequelize || (models.Address && models.Address.sequelize) || require('../../config/database').sequelize;
        let transaction = null;
        try {
            if (activeSequelize && typeof activeSequelize.transaction === 'function') {
                transaction = await activeSequelize.transaction();
            }
        } catch (txErr) {
            console.warn('⚠️ Could not open transaction, proceeding without transaction:', txErr.message);
            transaction = null;
        }
        const txOption = transaction ? { transaction } : {};

        try {
            // Check if structured address is provided
            let addressId = null;
            if (addressLine1 && pincode && models.Address) {
                console.log('Creating structured address...');
                const addressPayload = {
                    address_name: name || 'User Address',
                    address_line_1: addressLine1,
                    address_line_2: addressLine2 || null,
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
                const createdAddress = await models.Address.create(addressPayload, txOption);
                addressId = createdAddress.id;
                console.log('✅ Structured address created with ID:', addressId);
            }

            console.log('Creating User record in database...');
            const user = await models.User.create({
                name,
                email: email.toLowerCase().trim(),
                password_hash: password, // Will be hashed by the model hook
                mobile_number: mobileNumber || phone,
                head_office_id: (parsedHeadOffices && parsedHeadOffices.length > 0) ? null : validHeadOfficeId,
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
                state_id: validStateId,
                branch_id: validBranchId,
                department_id: validDepartmentId,
                designation_id: validDesignationId,
                employment_type_id: validEmploymentTypeId,
                legal_documents: legal_documents,
                email_verified: true,
                email_verified_at: new Date()
            }, txOption);

            console.log('✅ User record created with ID:', user.id);

            // Handle headOffices array if provided - safely filter existing head offices
            if (parsedHeadOffices && Array.isArray(parsedHeadOffices) && parsedHeadOffices.length > 0 && models.UserHeadOffice && models.HeadOffice) {
                const validUuids = parsedHeadOffices.filter(hoId => hoId && isUUID(hoId));
                if (validUuids.length > 0) {
                    const existingOffices = await models.HeadOffice.findAll({
                        where: { id: validUuids },
                        attributes: ['id'],
                        raw: true
                    }).catch(() => []);
                    const existingIds = new Set(existingOffices.map(o => o.id));
                    const userHeadOfficeRecords = validUuids
                        .filter(hoId => existingIds.has(hoId))
                        .map(headOfficeId => ({
                            user_id: user.id,
                            head_office_id: headOfficeId
                        }));

                    if (userHeadOfficeRecords.length > 0) {
                        await models.UserHeadOffice.bulkCreate(userHeadOfficeRecords, txOption);
                    }
                }
            }

            // Handle Managers if provided - safely filter existing users
            if (parsedManagers && Array.isArray(parsedManagers) && parsedManagers.length > 0 && models.UserManager) {
                const validUuids = parsedManagers.filter(mId => mId && isUUID(mId));
                if (validUuids.length > 0) {
                    const existingUsers = await models.User.findAll({
                        where: { id: validUuids },
                        attributes: ['id'],
                        raw: true
                    }).catch(() => []);
                    const existingIds = new Set(existingUsers.map(u => u.id));
                    const managerRecords = validUuids
                        .filter(mId => existingIds.has(mId))
                        .map(managerId => ({
                            user_id: user.id,
                            manager_id: managerId,
                            manager_type: 'manager'
                        }));

                    if (managerRecords.length > 0) {
                        await models.UserManager.bulkCreate(managerRecords, txOption);
                    }
                }
            }

            // Handle Area Managers if provided - safely filter existing users
            if (parsedAreaManagers && Array.isArray(parsedAreaManagers) && parsedAreaManagers.length > 0 && models.UserManager) {
                const validUuids = parsedAreaManagers.filter(amId => amId && isUUID(amId));
                if (validUuids.length > 0) {
                    const existingUsers = await models.User.findAll({
                        where: { id: validUuids },
                        attributes: ['id'],
                        raw: true
                    }).catch(() => []);
                    const existingIds = new Set(existingUsers.map(u => u.id));
                    const areaManagerRecords = validUuids
                        .filter(amId => existingIds.has(amId))
                        .map(areaManagerId => ({
                            user_id: user.id,
                            manager_id: areaManagerId,
                            manager_type: 'area_manager'
                        }));

                    if (areaManagerRecords.length > 0) {
                        await models.UserManager.bulkCreate(areaManagerRecords, txOption);
                    }
                }
            }

            if (transaction && typeof transaction.commit === 'function') {
                await transaction.commit();
                console.log('✅ Transaction committed successfully');
            }

            // Trigger WhatsApp welcome message template
            try {
                const { sendWelcomeMessage } = require('../../services/whatsappService');
                if (user.mobile_number) {
                    sendWelcomeMessage(user.mobile_number).catch(err => {
                        console.error('[WhatsApp Welcome] background register trigger error:', err);
                    });
                }
            } catch (err) {
                console.error('[WhatsApp Welcome] register trigger error:', err);
            }

            const token = JwtService.generateToken({
                id: user.id,
                role: user.role,
                ...(tenantContext && {
                    tenant: {
                        id: tenantContext.id,
                        name: tenantContext.name,
                        slug: tenantContext.slug,
                        subdomain: tenantContext.subdomain
                    }
                })
            }, '30d');

            const populatedUser = await models.User.findByPk(user.id, {
                include: models.HeadOffice ? [
                    {
                        model: models.HeadOffice,
                        as: 'headOffices',
                        through: { attributes: [] },
                        attributes: ['id', 'name', 'latitude', 'longitude']
                    }
                ] : []
            }).catch(() => null);

            let responseHeadOffices = [];
            if (populatedUser && populatedUser.headOffices && populatedUser.headOffices.length > 0) {
                responseHeadOffices = populatedUser.headOffices.map(ho => ({
                    id: ho.id,
                    name: ho.name,
                    latitude: ho.latitude,
                    longitude: ho.longitude
                }));
            }

            const companyData = await resolveCompanyData(tenantContext, models);

            return {
                success: true,
                token,
                meter_range: 200,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    headOffices: responseHeadOffices,
                    meter_range: 200,
                    ...(tenantContext && {
                        tenant: {
                            id: tenantContext.id,
                            name: tenantContext.name,
                            slug: tenantContext.slug,
                            subdomain: tenantContext.subdomain
                        }
                    })
                },
                company: companyData
            };
        } catch (dbError) {
            console.error('❌ Database/Internal Error during registration:', dbError);
            if (transaction && typeof transaction.rollback === 'function') {
                await transaction.rollback().catch(() => { });
            }
            throw dbError;
        }
    }

    static async login(body, req) {
        const { email, password, device_id, androidId, manufacturer, model } = body;
        const activeDeviceId = device_id || body.deviceId || androidId;
        const UserActivityLogService = require('../../userActivityLog/userActivityLogService');

        if (!email || !password) {
            throw { statusCode: 400, message: 'Email and password are required' };
        }

        if (typeof email !== 'string' || typeof password !== 'string') {
            throw { statusCode: 400, message: 'Email and password must be strings' };
        }

        console.log('Login attempt for email:', email);

        const { resolveTenantByEmail, resolveTenantFromRequest } = require('../../platform/tenantConnectionManager');

        let targetDbModels = null;
        let tenantContext = null;

        // 1. Try to resolve tenant from request header / subdomain
        const reqTenantResult = await resolveTenantFromRequest(req);
        if (reqTenantResult) {
            tenantContext = reqTenantResult.tenant;
            targetDbModels = reqTenantResult.db.models;
        }

        // 2. Fallback: Automatically resolve tenant by user's email
        if (!targetDbModels) {
            const emailTenantResult = await resolveTenantByEmail(email);
            if (emailTenantResult) {
                tenantContext = emailTenantResult.tenant;
                targetDbModels = emailTenantResult.db.models;
            }
        }

        let user;
        if (targetDbModels) {
            console.log(`🔌 [AuthService] Authenticating against isolated database: "${tenantContext.db_name}"`);
            user = await targetDbModels.User.findOne({
                where: { email: email.toLowerCase().trim(), is_active: true }
            });
        } else {
            user = await AuthRepository.findUserByEmailActive(email, true);
        }

        if (targetDbModels && req) {
            req.db = targetDbModels;
        }

        if (!user || !user.password_hash) {
            console.log('User not found or inactive, or no password set for:', email);
            await UserActivityLogService.logActivity(req, {
                email,
                action: 'FAILED_LOGIN',
                deviceId: activeDeviceId,
                details: { reason: 'User not found or inactive' },
                db: targetDbModels
            });
            throw { statusCode: 400, message: 'Invalid credentials' };
        }

        const bcrypt = require('bcryptjs');
        const isMatch = user.comparePassword
            ? await user.comparePassword(password)
            : await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            console.log('Password mismatch for user:', email);
            await UserActivityLogService.logActivity(req, {
                userId: user.id,
                email: user.email,
                action: 'FAILED_LOGIN',
                deviceId: activeDeviceId,
                details: { reason: 'Password mismatch' },
                db: targetDbModels
            });
            throw { statusCode: 400, message: 'Invalid credentials' };
        }
        console.log('✅ Password verified for user:', email, 'Role:', user.role, tenantContext ? `Tenant: ${tenantContext.slug}` : 'Main DB');

        // DEVICE FINGERPRINTING & BINDING LOGIC
        const { generateDeviceFingerprint, validateDeviceInfo, getDeviceName } = require('../../utils/deviceFingerprint');

        if ((androidId && manufacturer && model) || activeDeviceId) {
            console.log('📱 Device info/ID provided:', { activeDeviceId, androidId, manufacturer, model });

            let deviceFingerprint = activeDeviceId;
            let deviceName = activeDeviceId;

            if (androidId && manufacturer && model && validateDeviceInfo({ androidId, manufacturer, model })) {
                deviceFingerprint = generateDeviceFingerprint(androidId, manufacturer, model);
                deviceName = getDeviceName(manufacturer, model);
            }

            console.log('🔐 Device identifier:', deviceFingerprint);

            const existingUserDevice = await AuthRepository.findActiveUserDevice(user.id);

            if (existingUserDevice) {
                console.log('📱 User has existing device binding');

                if (existingUserDevice.device_id !== activeDeviceId && existingUserDevice.android_id !== activeDeviceId && existingUserDevice.device_fingerprint !== deviceFingerprint) {
                    console.log('🚫 Device mismatch!');
                    await UserActivityLogService.logActivity(req, {
                        userId: user.id,
                        email: user.email,
                        action: 'FAILED_LOGIN',
                        deviceId: activeDeviceId,
                        details: { reason: 'Device registration mismatch', registeredDevice: existingUserDevice.device_name }
                    });
                    throw {
                        statusCode: 403,
                        deviceMismatch: true,
                        message: 'Device already registered',
                        error: 'This account is already registered to another device. Please contact your administrator to reset the device binding if you have replaced your tablet or performed a factory reset.',
                        registeredDevice: {
                            name: existingUserDevice.device_name || 'Registered Device',
                            lastLogin: existingUserDevice.last_login
                        }
                    };
                }

                console.log('✅ Device matches - allowing login');
                await existingUserDevice.update({
                    last_login: new Date()
                });
            } else {
                console.log('🆕 First login - binding device to user');

                try {
                    const bindingInUse = await AuthRepository.findActiveDeviceByFingerprint(deviceFingerprint) ||
                        await AuthRepository.findDeviceById(activeDeviceId);

                    if (bindingInUse && bindingInUse.user_id !== user.id && bindingInUse.status === 'ACTIVE') {
                        console.log('🚫 Device already bound to another user');
                        await UserActivityLogService.logActivity(req, {
                            userId: user.id,
                            email: user.email,
                            action: 'FAILED_LOGIN',
                            deviceId: activeDeviceId,
                            details: { reason: 'Device already bound to another user' }
                        });
                        throw {
                            statusCode: 403,
                            deviceInUse: true,
                            message: 'Device already registered to another user',
                            error: 'This device is already registered to another account. Each device can only be used by one user.'
                        };
                    }

                    if (bindingInUse) {
                        console.log('📱 Updating existing device binding for user');
                        await bindingInUse.update({
                            user_id: user.id,
                            status: 'ACTIVE',
                            is_active: true,
                            last_login: new Date()
                        });
                    } else {
                        await AuthRepository.createDevice({
                            user_id: user.id,
                            device_id: activeDeviceId,
                            android_id: androidId || activeDeviceId,
                            manufacturer: manufacturer || 'Android',
                            model: model || 'Device',
                            device_fingerprint: deviceFingerprint,
                            device_name: deviceName,
                            device_type: 'android',
                            status: 'ACTIVE',
                            is_active: true,
                            last_login: new Date()
                        });
                    }
                    console.log('✅ Device bound successfully:', deviceName);
                    await UserActivityLogService.logActivity(req, {
                        userId: user.id,
                        email: user.email,
                        action: 'BIND_DEVICE',
                        deviceId: activeDeviceId,
                        details: { deviceName, manufacturer, model }
                    });
                } catch (deviceError) {
                    if (deviceError.statusCode) throw deviceError;
                    console.error('Device binding error (handled safely):', deviceError);
                }
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
                    await UserActivityLogService.logActivity(req, {
                        userId: user.id,
                        email: user.email,
                        action: 'BIND_DEVICE',
                        deviceId: device_id,
                        details: { legacy: true }
                    });
                }
            } catch (deviceError) {
                console.error('Device registration error:', deviceError);
            }
        }

        const tokenPayload = {
            id: user.id,
            role: user.role,
            ...(tenantContext && {
                tenant: {
                    id: tenantContext.id,
                    name: tenantContext.name,
                    slug: tenantContext.slug,
                    db_name: tenantContext.db_name,
                    subdomain: tenantContext.subdomain
                }
            })
        };
        const token = JwtService.generateToken(tokenPayload, '30d');

        const headOffices = await getUserAssignedHeadOffices(user, targetDbModels);

        const responseUser = {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: user.email_verified,
            phone: user.mobile_number,
            headOffices: headOffices,
            meter_range: 200,
            ...(tenantContext && {
                tenant: {
                    id: tenantContext.id,
                    name: tenantContext.name,
                    slug: tenantContext.slug,
                    subdomain: tenantContext.subdomain
                }
            })
        };

        console.log('✅ Login successful - Sending response for user:', responseUser.id);

        await UserActivityLogService.logActivity(req, {
            userId: user.id,
            email: user.email,
            action: 'LOGIN',
            deviceId: activeDeviceId,
            details: { role: user.role },
            db: targetDbModels
        });

        const companyData = await resolveCompanyData(tenantContext, targetDbModels);

        return {
            success: true,
            token,
            meter_range: 200,
            user: responseUser,
            company: companyData
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
                    attributes: ['id', 'name', 'latitude', 'longitude']
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

        const token = JwtService.generateToken({ id: user.id, role: user.role }, '30d');

        console.log(`🚀 Email login successful for ${email}`);

        const { resolveTenantByEmail } = require('../../platform/tenantConnectionManager');
        let targetDbModels = null;
        let tenantContext = null;
        try {
            const emailTenantResult = await resolveTenantByEmail(email);
            if (emailTenantResult) {
                tenantContext = emailTenantResult.tenant;
                targetDbModels = emailTenantResult.db.models;
            }
        } catch (e) { }

        const companyData = await resolveCompanyData(tenantContext, targetDbModels);

        return {
            success: true,
            msg: 'Login successful',
            token,
            meter_range: 200,
            user: {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                role: user.role,
                emailVerified: user.email_verified,
                employeeCode: user.employee_code,
                headOffices: user.HeadOffice ? [{
                    id: user.HeadOffice.id,
                    name: user.HeadOffice.name,
                    latitude: user.HeadOffice.latitude,
                    longitude: user.HeadOffice.longitude
                }] : [],
                meter_range: 200,
                ...(tenantContext && {
                    tenant: {
                        id: tenantContext.id,
                        name: tenantContext.name,
                        slug: tenantContext.slug,
                        subdomain: tenantContext.subdomain
                    }
                })
            },
            company: companyData
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
        const user = await AuthRepository.findUserById(userId);

        if (!user) throw { statusCode: 404, message: 'User not found' };

        const headOffices = await getUserAssignedHeadOffices(user);

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                employeeCode: user.employee_code,
                emailVerified: user.email_verified,
                headOffices: headOffices,
                meter_range: 200
            }
        };
    }
}

module.exports = AuthService;
