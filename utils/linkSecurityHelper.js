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

const isPrivateOrLocalIp = (ip) => {
    const value = String(ip || '').trim().toLowerCase();
    if (!value) return true;
    if (value === '127.0.0.1' || value === '::1' || value === 'localhost') return true;
    if (value.startsWith('10.')) return true;
    if (value.startsWith('192.168.')) return true;
    if (value.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true;
    if (value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) return true;
    return false;
};

const buildGeoLabel = ({ country, region, city }) => {
    const parts = [country, region, city].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
};

/**
 * Local geoip-lite lookup (no network call). Approximate IP location only — not GPS.
 * Returns country/region/city/ll plus a readable `label` for VARCHAR GeoLocation columns.
 * On failure: all fields null (caller should continue without failing the request).
 */
export const getLocationFromIp = (ip) => {
    const empty = {
        country: null,
        region: null,
        city: null,
        ll: null,
        label: null
    };
    if (!ip || isPrivateOrLocalIp(ip)) return empty;

    let geo;
    try {
        geo = geoip.lookup(String(ip).trim());
    } catch {
        return empty;
    }
    if (!geo) return empty;

    const country = geo.country
        ? (countries.getName(geo.country, 'en') || geo.country)
        : null;
    const region = geo.region ? String(geo.region).trim() || null : null;
    const city = geo.city ? String(geo.city).trim() || null : null;
    const ll = Array.isArray(geo.ll) && geo.ll.length >= 2 ? geo.ll : null;
    const label = buildGeoLabel({ country, region, city });

    return { country, region, city, ll, label };
};

/**
 * Resolve a readable GeoLocation label for survey_data.
 * 1) local geoip-lite (fast)
 * 2) short-timeout HTTP fallback for public IPs when local DB misses
 * Never throws — returns null on failure.
 */
export const resolveGeoLocationLabel = async (ip, { timeoutMs = 2000 } = {}) => {
    try {
        const local = getLocationFromIp(ip);
        if (local?.label || local?.country) {
            return local.label || local.country;
        }

        if (!ip || isPrivateOrLocalIp(ip)) {
            return null;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const url = `http://ip-api.com/json/${encodeURIComponent(String(ip).trim())}?fields=status,country,regionName,city`;
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) return null;
            const data = await res.json();
            if (data?.status !== 'success') return null;
            return buildGeoLabel({
                country: data.country || null,
                region: data.regionName || null,
                city: data.city || null
            });
        } finally {
            clearTimeout(timer);
        }
    } catch {
        return null;
    }
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

/** Plain uid -> encrypted, URL-safe token. Used when building the survey link for an email. */
export const encryptUid = (uid) => {
    if (uid === null || uid === undefined || uid === '') return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(uid), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, encrypted]).toString('base64url');
};

/** Encrypted token -> plain uid. Used when a respondent opens the survey link. */
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