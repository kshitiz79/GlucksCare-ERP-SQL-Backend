// src/utils/deviceFingerprint.js

const crypto = require('crypto');

/**
 * Generate a device fingerprint hash from device components
 * @param {string} androidId - Android ANDROID_ID
 * @param {string} manufacturer - Device manufacturer
 * @param {string} model - Device model
 * @returns {string} SHA-256 hash of the combined device info
 */
function generateDeviceFingerprint(androidId, manufacturer, model) {
    if (!androidId || !manufacturer || !model) {
        throw new Error('All device components (androidId, manufacturer, model) are required for fingerprinting');
    }

    // Normalize inputs (trim and lowercase for consistency)
    const normalizedAndroidId = androidId.trim();
    const normalizedManufacturer = manufacturer.trim().toLowerCase();
    const normalizedModel = model.trim().toLowerCase();

    // Combine components
    const combined = `${normalizedAndroidId}|${normalizedManufacturer}|${normalizedModel}`;

    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    return hash;
}

/**
 * Validate device fingerprint components
 * @param {object} deviceInfo - Object containing androidId, manufacturer, model
 * @returns {boolean} True if all components are present and valid
 */
function validateDeviceInfo(deviceInfo) {
    const { androidId, manufacturer, model } = deviceInfo || {};

    if (!androidId || typeof androidId !== 'string' || androidId.trim().length === 0) {
        return false;
    }

    if (!manufacturer || typeof manufacturer !== 'string' || manufacturer.trim().length === 0) {
        return false;
    }

    if (!model || typeof model !== 'string' || model.trim().length === 0) {
        return false;
    }

    return true;
}

/**
 * Get human-readable device name
 * @param {string} manufacturer - Device manufacturer
 * @param {string} model - Device model
 * @returns {string} Human-readable device name
 */
function getDeviceName(manufacturer, model) {
    if (!manufacturer || !model) {
        return 'Unknown Device';
    }

    // Capitalize first letter of manufacturer
    const capitalizedManufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();

    return `${capitalizedManufacturer} ${model}`;
}

module.exports = {
    generateDeviceFingerprint,
    validateDeviceInfo,
    getDeviceName
};
