// src/repositories/user.repository.js

const { User, HeadOffice } = require('../config/database');

class UserRepository {
    static async findByEmail(email, options = {}) {
        return User.findOne({
            where: { email },
            ...options
        });
    }

    static async findByEmailActive(email, includeHeadOffices = false) {
        const options = {
            where: {
                email,
                is_active: true
            }
        };
        if (includeHeadOffices) {
            options.include = [
                {
                    model: HeadOffice,
                    as: 'headOffices',
                    through: { attributes: [] },
                    attributes: ['id', 'name', 'latitude', 'longitude']
                }
            ];
        }
        return User.findOne(options);
    }

    static async findById(id, options = {}) {
        return User.findByPk(id, options);
    }

    static async findByEmployeeCode(employeeCode) {
        return User.findOne({
            where: { employee_code: employeeCode }
        });
    }

    static async create(data, options = {}) {
        return User.create(data, options);
    }

    static async updateOtp(userId, otp, otpExpire) {
        return User.update(
            { otp, otp_expire: otpExpire },
            { where: { id: userId } }
        );
    }

    static async clearOtpAndVerifyEmail(userId) {
        return User.update(
            {
                otp: null,
                otp_expire: null,
                email_verified: true,
                email_verified_at: new Date()
            },
            { where: { id: userId } }
        );
    }
}

module.exports = UserRepository;
