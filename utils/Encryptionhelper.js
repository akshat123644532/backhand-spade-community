import crypto from 'crypto';

// Comment - remove the fall back secret key always keep it in .env file
const SALT = process.env.URL_ENCRYPT_SALT || 'abxcsdfds234242424234435';
const ALGORITHM = 'aes-256-cbc';
const KEY = crypto.createHash('sha256').update(SALT).digest(); // 32 bytes for aes-256
const IV_LENGTH = 16;


export const encryptId = (id) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(id.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const combined = iv.toString('hex') + ':' + encrypted;
    return encodeURIComponent(combined);
};

export const decryptId = (encoded) => {
    const combined = decodeURIComponent(encoded);
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