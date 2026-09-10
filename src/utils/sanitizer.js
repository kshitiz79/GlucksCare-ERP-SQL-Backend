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

/**
 * Resolves head office ID from various formats and keys
 */
const resolveHeadOfficeId = (data, user = null) => {
  if (!data || typeof data !== 'object') return null;

  let val = data.headOfficeId || data.head_office_id || data.headOffice || data.head_office;
  if (val) return val;

  for (const [key, value] of Object.entries(data)) {
    const cleanKey = normalizeText(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((cleanKey === 'headofficeid' || cleanKey === 'headoffice' || cleanKey === 'headoffice_id') && value) {
      return value;
    }
  }

  // Fallback to user's assigned head office if available
  if (user) {
    if (user.headOfficeId) return user.headOfficeId;
    if (user.head_office_id) return user.head_office_id;
    if (Array.isArray(user.headOffices) && user.headOffices.length === 1) {
      return user.headOffices[0].id || user.headOffices[0];
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
  if (val) return val;

  for (const [key, value] of Object.entries(data)) {
    const cleanKey = normalizeText(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((cleanKey === 'areaid' || cleanKey === 'area' || cleanKey === 'area_id') && value) {
      return value;
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
  if (val) return val;

  for (const [key, value] of Object.entries(data)) {
    const cleanKey = normalizeText(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    if ((cleanKey === 'clientgeneratedid' || cleanKey === 'clientid' || cleanKey === 'localid') && value) {
      return value;
    }
  }

  return null;
};

module.exports = {
  normalizeText,
  sanitizePayload,
  resolveHeadOfficeId,
  resolveAreaId,
  resolveClientGeneratedId
};
