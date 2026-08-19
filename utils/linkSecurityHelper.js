import geoip from 'geoip-lite';
import crypto from 'crypto';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

countries.registerLocale(enLocale);

export const getCountryFromIp = (ip) => {
    if (!ip) return null;
    const geo = geoip.lookup(ip);
    if (!geo || !geo.country) return null;
    return countries.getName(geo.country, 'en') || geo.country;
};

const SIGNING_SECRET = process.env.LINK_SIGNING_SECRET || 'change-this-secret-in-env';

export const generateLinkSignature = (pid, uid) => {
    return crypto
        .createHmac('sha256', SIGNING_SECRET)
        .update(`${pid}::${uid}`)
        .digest('hex')
        .slice(0, 16);
};

export const verifyLinkSignature = (pid, uid, providedSig) => {
    if (!providedSig) return false;
    const expected = generateLinkSignature(pid, uid);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(providedSig));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
};

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto
    .createHash('sha256')
    .update(String(process.env.LINK_ENCRYPTION_KEY || 'change-this-secret-in-env'))
    .digest();

export const encryptUid = (uid) => {
    if (uid === null || uid === undefined || uid === '') return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(uid), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, encrypted]).toString('base64url');
};

export const decryptUid = (token) => {
    if (!token) return null;
    try {
        const buf = Buffer.from(String(token), 'base64url');
        const iv = buf.subarray(0, 16);
        const encrypted = buf.subarray(16);
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
    } catch {
        return null;
    }
};