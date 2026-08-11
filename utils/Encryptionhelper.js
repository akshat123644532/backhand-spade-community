import crypto from 'crypto';

const SALT = process.env.URL_ENCRYPT_SALT;

if (!SALT) {
    throw new Error('URL_ENCRYPT_SALT is not set in .env file! Application cannot start without it.');
}

const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(SALT).digest(); // 32 bytes for aes-256
const IV_LENGTH = 16;

const toBase64Url = (buf) =>
    Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const fromBase64Url = (str) => {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4;
    if (pad) s += '='.repeat(4 - pad);
    return Buffer.from(s, 'base64');
};

/** New shorter format: base64url(iv).base64url(ciphertext) */
export const encryptId = (id) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([
        cipher.update(Buffer.from(id.toString(), 'utf8')),
        cipher.final()
    ]);

    const combined = `${toBase64Url(iv)}.${toBase64Url(encrypted)}`;
    return encodeURIComponent(combined);
};

const decryptHexLegacy = (combined) => {
    const [ivHex, encryptedHex] = combined.split(':');
    if (!ivHex || !encryptedHex) {
        throw new Error('Invalid encrypted ID format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

const decryptBase64Url = (combined) => {
    const [ivPart, dataPart] = combined.split('.');
    if (!ivPart || !dataPart) {
        throw new Error('Invalid encrypted ID format');
    }
    const iv = fromBase64Url(ivPart);
    const encrypted = fromBase64Url(dataPart);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

/** Accepts new base64url tokens and legacy hex (iv:ciphertext) tokens */
export const decryptId = (encoded) => {
    const combined = decodeURIComponent(encoded);

    // New format uses '.' ; legacy hex used ':'
    if (combined.includes('.')) {
        try {
            return decryptBase64Url(combined);
        } catch {
            // fall through to legacy if mis-detected
        }
    }
    if (combined.includes(':')) {
        return decryptHexLegacy(combined);
    }

    throw new Error('Invalid encrypted ID format');
};

/**
 * Compact survey token payload keys (shorter ciphertext):
 *   p = partnerid, u = projectUrlId, j = projectid, s = startDate, e = endDate
 * Consumers always receive the expanded field names.
 */
export const packSurveyPayload = (data = {}) => {
    const packed = {
        p: data.partnerid ?? data.p ?? null,
        u: data.projectUrlId ?? data.u,
        j: data.projectid ?? data.j
    };
    const startDate = data.startDate ?? data.s;
    const endDate = data.endDate ?? data.e;
    if (startDate != null && startDate !== '') packed.s = startDate;
    if (endDate != null && endDate !== '') packed.e = endDate;
    return JSON.stringify(packed);
};

export const unpackSurveyPayload = (parsed = {}) => {
    // Compact keys present
    if (
        Object.prototype.hasOwnProperty.call(parsed, 'u') ||
        Object.prototype.hasOwnProperty.call(parsed, 'j') ||
        Object.prototype.hasOwnProperty.call(parsed, 'p')
    ) {
        return {
            partnerid: parsed.p ?? null,
            projectUrlId: parsed.u,
            projectid: parsed.j,
            startDate: parsed.s ?? null,
            endDate: parsed.e ?? null
        };
    }
    // Legacy full-key JSON
    return {
        partnerid: parsed.partnerid ?? null,
        projectUrlId: parsed.projectUrlId,
        projectid: parsed.projectid,
        startDate: parsed.startDate ?? null,
        endDate: parsed.endDate ?? null
    };
};

export const encryptSurveyToken = (payload) => encryptId(packSurveyPayload(payload));

export const decryptSurveyToken = (token) => {
    const parsed = JSON.parse(decryptId(token));
    return unpackSurveyPayload(parsed);
};
