import dotenv from 'dotenv';

dotenv.config();

const stripQuotes = (value) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
};

const toBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
const user = process.env.SMTP_USER || process.env.EMAIL_USER || '';
const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').replace(/\s/g, '');
const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
const secure = process.env.SMTP_SECURE !== undefined
    ? toBool(process.env.SMTP_SECURE, port === 465)
    : port === 465;

const defaultFrom = user ? `"Spade Community" <${user}>` : '';
const from = stripQuotes(process.env.SMTP_FROM || process.env.EMAIL_FROM) || defaultFrom;

export const smtpConfig = {
    host,
    port,
    secure,
    user,
    pass,
    from,
    rejectUnauthorized: toBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, false),
};

export default smtpConfig;
