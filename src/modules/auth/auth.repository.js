// src/modules/auth/auth.repository.js

const UserRepository = require('../../repositories/user.repository');
const { Address, UserHeadOffice, UserManager, UserDevice, HeadOffice } = require('../../config/database');

class AuthRepository {
    static async findUserByEmail(email, options = {}) {
        return UserRepository.findByEmail(email, options);
    }

    static async findUserByEmailActive(email, includeHeadOffices = false) {
        return UserRepository.findByEmailActive(email, includeHeadOffices);
    }

    static async findUserByEmployeeCode(employeeCode) {
        return UserRepository.findByEmployeeCode(employeeCode);
    }

    static async findUserById(id, options = {}) {
        return UserRepository.findById(id, options);
    }

    static async createUser(userData, transaction) {
        return UserRepository.create(userData, { transaction });
    }

    static async createAddress(addressData, transaction) {
        return Address.create(addressData, { transaction });
    }

    static async bulkCreateUserHeadOffices(records, transaction) {
        return UserHeadOffice.bulkCreate(records, { transaction });
    }

    static async bulkCreateUserManagers(records, transaction) {
        return UserManager.bulkCreate(records, { transaction });
    }

    static async findActiveUserDevice(userId) {
        return UserDevice.findOne({
            where: {
                user_id: userId,
                status: 'ACTIVE'
            }
        });
    }

    static async findActiveDeviceByFingerprint(fingerprint) {
        return UserDevice.findOne({
            where: {
                device_fingerprint: fingerprint,
                status: 'ACTIVE'
            }
        });
    }

    static async findDeviceById(deviceId) {
        return UserDevice.findOne({
            where: { device_id: deviceId }
        });
    }

    static async createDevice(deviceData, transaction) {
        return UserDevice.create(deviceData, transaction);
    }

    static async findHeadOfficeById(id, options = {}) {
        return HeadOffice.findByPk(id, options);
    }
}

module.exports = AuthRepository;
