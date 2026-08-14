import geoip from 'geoip-lite';
import crypto from 'crypto';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

countries.registerLocale(enLocale);

/** IP se country ka full naam nikalo (ya null agar na mile) */
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