import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SURVEY_ID_BASE = 1_000_000n;
const SURVEY_ID_MAX = 999_999;

let cachedKey = null;
const getAesKey = () => {
    if (cachedKey) return cachedKey;
    const SALT = process.env.URL_ENCRYPT_SALT;
    if (!SALT) {
        throw new Error('URL_ENCRYPT_SALT is not set in .env file! Application cannot start without it.');
    }
    cachedKey = crypto.createHash('sha256').update(SALT).digest();
    return cachedKey;
};

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

/** AES encryption — still used for panelist IDs and legacy survey tokens */
export const encryptId = (id) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getAesKey(), iv);
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
    const decipher = crypto.createDecipheriv(ALGORITHM, getAesKey(), iv);
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
    const decipher = crypto.createDecipheriv(ALGORITHM, getAesKey(), iv);
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
 * Compact survey token payload keys (legacy AES JSON):
 *   p = partnerid, u = projectUrlId, j = projectid, s = startDate, e = endDate
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
    return {
        partnerid: parsed.partnerid ?? null,
        projectUrlId: parsed.projectUrlId,
        projectid: parsed.projectid,
        startDate: parsed.startDate ?? null,
        endDate: parsed.endDate ?? null
    };
};

/** Encode a non-negative BigInt / integer as Base62 */
export const encodeBase62 = (value) => {
    let n = typeof value === 'bigint' ? value : BigInt(value);
    if (n < 0n) {
        throw new Error('Cannot encode a negative value as Base62');
    }
    if (n === 0n) return '0';

    let out = '';
    while (n > 0n) {
        out = BASE62_ALPHABET[Number(n % 62n)] + out;
        n /= 62n;
    }
    return out;
};

/** Decode a Base62 string to BigInt */
export const decodeBase62 = (token) => {
    if (token == null || String(token).trim() === '') {
        throw new Error('Token is empty');
    }

    const s = String(token).trim();
    let result = 0n;
    for (const ch of s) {
        const idx = BASE62_ALPHABET.indexOf(ch);
        if (idx < 0) {
            throw new Error(`Invalid Base62 character: '${ch}'`);
        }
        result = result * 62n + BigInt(idx);
    }
    return result;
};

const assertSurveyId = (value, fieldName, { allowNull = false } = {}) => {
    if (value === null || value === undefined || value === '') {
        if (allowNull) return 0;
        throw new Error(`${fieldName} is required and must be an integer`);
    }

    if (typeof value === 'boolean') {
        throw new Error(`${fieldName} must be an integer`);
    }

    if (typeof value === 'bigint') {
        if (value < 0n || value > BigInt(SURVEY_ID_MAX)) {
            throw new Error(`${fieldName} must be an integer between 0 and ${SURVEY_ID_MAX}`);
        }
        return Number(value);
    }

    if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
            throw new Error(`${fieldName} must be an integer (decimals are not allowed)`);
        }
        if (value < 0 || value > SURVEY_ID_MAX) {
            throw new Error(`${fieldName} must be an integer between 0 and ${SURVEY_ID_MAX}`);
        }
        return value;
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) {
            throw new Error(`${fieldName} must be an integer (decimals are not allowed)`);
        }
        const n = Number(trimmed);
        if (!Number.isInteger(n) || n < 0 || n > SURVEY_ID_MAX) {
            throw new Error(`${fieldName} must be an integer between 0 and ${SURVEY_ID_MAX}`);
        }
        return n;
    }

    throw new Error(`${fieldName} must be an integer`);
};

/**
 * Compact reversible survey token (Base62, ~11 chars max).
 * packed = partnerId * BASE^2 + projectUrlId * BASE + projectId
 * partnerid null/undefined → 0
 */
export const encodeSurveyToken = ({ partnerid, projectUrlId, projectid } = {}) => {
    const p = assertSurveyId(partnerid, 'partnerid', { allowNull: true });
    const u = assertSurveyId(projectUrlId, 'projectUrlId');
    const j = assertSurveyId(projectid, 'projectid');

    const packed =
        BigInt(p) * SURVEY_ID_BASE * SURVEY_ID_BASE +
        BigInt(u) * SURVEY_ID_BASE +
        BigInt(j);

    return encodeBase62(packed);
};

const decodeCompactSurveyToken = (token) => {
    const packed = decodeBase62(token);
    const partnerid = Number(packed / (SURVEY_ID_BASE * SURVEY_ID_BASE));
    const rem = packed % (SURVEY_ID_BASE * SURVEY_ID_BASE);
    const projectUrlId = Number(rem / SURVEY_ID_BASE);
    const projectid = Number(rem % SURVEY_ID_BASE);

    for (const [name, id] of [
        ['partnerid', partnerid],
        ['projectUrlId', projectUrlId],
        ['projectid', projectid]
    ]) {
        if (!Number.isInteger(id) || id < 0 || id > SURVEY_ID_MAX) {
            throw new Error(`Decoded ${name} is out of range`);
        }
    }

    return {
        partnerid,
        projectUrlId,
        projectid,
        // Compact tokens do not carry dates; keep keys for callers
        startDate: null,
        endDate: null
    };
};

const looksLikeCompactSurveyToken = (token) => /^[0-9A-Za-z]+$/.test(token);

/**
 * Decode survey token.
 * Prefer compact Base62; fall back to legacy AES JSON so existing links keep working.
 */
export const decodeSurveyToken = (token) => {
    if (token == null || String(token).trim() === '') {
        throw new Error('Token is empty');
    }

    const raw = String(token).trim();

    if (looksLikeCompactSurveyToken(raw)) {
        return decodeCompactSurveyToken(raw);
    }

    // Legacy AES-encrypted JSON survey token
    const parsed = JSON.parse(decryptId(raw));
    return unpackSurveyPayload(parsed);
};

/** @deprecated Prefer encodeSurveyToken — kept as alias for older call sites */
export const encryptSurveyToken = (payload) => encodeSurveyToken(payload);

/** @deprecated Prefer decodeSurveyToken — kept as alias (includes legacy fallback) */
export const decryptSurveyToken = (token) => decodeSurveyToken(token);
