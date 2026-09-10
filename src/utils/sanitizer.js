/**
 * Utility functions for payload sanitization and field normalization.
 * Handles Unicode ligatures (e.g. \uFB03 'ﬃ' -> 'ffi'), smart quotes, and zero-width spaces.
 */

const LIGATURE_MAP = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'ft',
  '\uFB06': 'st',
  '\u201C': '"',
  '\u201D': '"',
  '\u2018': "'",
  '\u2019': "'",
  '\u200B': '', // zero-width space
  '\u200C': '', // zero-width non-joiner
  '\u200D': '', // zero-width joiner
  '\uFEFF': ''  // byte order mark
};

const normalizeText = (text) => {
  if (typeof text !== 'string') return text;
  let normalized = text.normalize('NFKD');
  for (const [ligature, replacement] of Object.entries(LIGATURE_MAP)) {
    normalized = normalized.split(ligature).join(replacement);
  }
  return normalized;
};

/**
 * Recursively cleans object keys and string values from Unicode ligatures
 */
const sanitizePayload = (input) => {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'object' && parsed !== null) {
        return sanitizePayload(parsed);
      }
    } catch {
      return normalizeText(input);
    }
    return normalizeText(input);
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizePayload(item));
  }
  if (typeof input === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = normalizeText(key).trim();
      cleaned[normalizedKey] = sanitizePayload(value);
    }
    return cleaned;
  }
  return input;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUUID = (val) => {
  if (typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
};

const isValidValue = (val) => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
      return false;
    }
  }
  return true;
};

/**
 * Resolves head office ID from various formats and keys
 */
const resolveHeadOfficeId = (data, user = null) => {
  if (!data || typeof data !== 'object') return null;

  let val = data.headOfficeId || data.head_office_id || data.headOffice || data.head_office;
  if (isValidValue(val)) return typeof val === 'string' ? val.trim() : val;

  for (const [key, value] of Object.entries(data)) {
    const cleanKey = normalizeText(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((cleanKey === 'headofficeid' || cleanKey === 'headoffice' || cleanKey === 'headoffice_id') && isValidValue(value)) {
      return typeof value === 'string' ? value.trim() : value;
    }
  }

  // Fallback to user's assigned head office if available
  if (user) {
    if (isValidValue(user.headOfficeId)) return user.headOfficeId;
    if (isValidValue(user.head_office_id)) return user.head_office_id;
    if (Array.isArray(user.headOffices) && user.headOffices.length === 1) {
      const ho = user.headOffices[0];
      return ho.id || ho;
    }
  }

  return null;
};

/**
 * Resolves area ID from various formats and keys
 */
const resolveAreaId = (data) => {
  if (!data || typeof data !== 'object') return null;

  let val = data.areaId || data.area_id || data.area;
  if (isValidValue(val)) return typeof val === 'string' ? val.trim() : val;

  for (const [key, value] of Object.entries(data)) {
    const cleanKey = normalizeText(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((cleanKey === 'areaid' || cleanKey === 'area' || cleanKey === 'area_id') && isValidValue(value)) {
      return typeof value === 'string' ? value.trim() : value;
    }
  }

  return null;
};

/**
 * Resolves clientGeneratedId for offline sync
 */
const resolveClientGeneratedId = (data) => {
  if (!data || typeof data !== 'object') return null;

  let val = data.clientGeneratedId ||
            data.client_generated_id ||
            data.clientId ||
            data.client_id ||
            data.localId ||
            data.local_id;
  if (isValidValue(val)) return typeof val === 'string' ? val.trim() : val;

  for (const [key, value] of Object.entries(data)) {
    const cleanKey = normalizeText(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((cleanKey === 'clientgeneratedid' || cleanKey === 'clientid' || cleanKey === 'localid') && isValidValue(value)) {
      return typeof value === 'string' ? value.trim() : value;
    }
  }

  return null;
};

module.exports = {
  isUUID,
  normalizeText,
  sanitizePayload,
  resolveHeadOfficeId,
  resolveAreaId,
  resolveClientGeneratedId
};
