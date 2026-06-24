// src/modules/auth/auth.validation.js

const Joi = require('joi');

const registerSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    employeeCode: Joi.string().required(),
    gender: Joi.string().required(),
    role: Joi.string().optional().allow(''),
    phone: Joi.string().optional().allow(''),
    mobileNumber: Joi.string().optional().allow(''),
    headOffice: Joi.string().optional().allow(null, ''),
    salaryType: Joi.string().optional().allow(''),
    salaryAmount: Joi.any().optional().allow(null, ''),
    address: Joi.string().optional().allow(''),
    dateOfBirth: Joi.string().optional().allow(null, ''),
    dateOfJoining: Joi.string().optional().allow(null, ''),
    bankDetails: Joi.any().optional(),
    emergencyContact: Joi.any().optional(),
    reference: Joi.any().optional(),
    state: Joi.string().optional().allow(null, ''),
    headOffices: Joi.any().optional(),
    branch: Joi.string().optional().allow(null, ''),
    department: Joi.string().optional().allow(null, ''),
    designation: Joi.string().optional().allow(null, ''),
    employmentType: Joi.string().optional().allow(null, ''),
    managers: Joi.any().optional(),
    areaManagers: Joi.any().optional(),
    addressLine1: Joi.string().optional().allow(''),
    addressLine2: Joi.string().optional().allow(''),
    landmark: Joi.string().optional().allow(''),
    pincode: Joi.string().optional().allow(''),
    postOffice: Joi.string().optional().allow(''),
    district: Joi.string().optional().allow(''),
    country: Joi.string().optional().allow('')
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    device_id: Joi.string().optional().allow(''),
    androidId: Joi.string().optional().allow(''),
    manufacturer: Joi.string().optional().allow(''),
    model: Joi.string().optional().allow('')
});

module.exports = {
    registerSchema,
    loginSchema
};
