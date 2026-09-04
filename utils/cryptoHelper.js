import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import CryptoJS from "crypto-js";
import path from "path";
import { fileURLToPath } from "url";

// ✅ FIX: Load .env with correct path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

console.log('📁 Loading .env from:', envPath);
const envConfig = dotenv.config({ path: envPath });

if (envConfig.error) {
    console.error('❌ .env not found at:', envPath);
    process.exit(1);
}

// ✅ FIX: Check BEFORE parsing
if (!process.env.ENCRYPTION_KEY1 || !process.env.ENCRYPTION_KEY2) {
    console.error('❌ ERROR: ENCRYPTION_KEY1 and ENCRYPTION_KEY2 must be set in .env');
    console.error('Current .env location:', envPath);
    console.error('Keys found:', Object.keys(process.env).filter(k => k.includes('ENCRYPTION')));
    process.exit(1);
}

console.log('✅ ENCRYPTION_KEY1 loaded');
console.log('✅ ENCRYPTION_KEY2 loaded');

// ✅ NOW parse after checking
const ENCRYPTION_KEY1 = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY1);
const ENCRYPTION_KEY2 = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY2);

export const encrypt = (text) => {
    if (typeof text !== "string") {
        throw new Error("Input text must be a string");
    }
    try {
        const iv = CryptoJS.lib.WordArray.random(16);
        const encrypted1 = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY1, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        });
        const encrypted2 = CryptoJS.AES.encrypt(encrypted1.toString(), ENCRYPTION_KEY2, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        });
        return `${iv.toString(CryptoJS.enc.Hex)}:${encrypted2.toString()}`;
    } catch (error) {
        console.error('Encryption error:', error);
        throw error;
    }
};

export const decrypt = (encryptedText) => {
    if (typeof encryptedText !== "string") {
        throw new Error("Encrypted text must be a string");
    }
    try {
        const parts = encryptedText.split(":");
        if (parts.length < 2) {
            throw new Error("Invalid encrypted text format");
        }
        const iv = CryptoJS.enc.Hex.parse(parts[0]);
        const encryptedTextPart = parts.slice(1).join(":");
        const decrypted1 = CryptoJS.AES.decrypt(encryptedTextPart, ENCRYPTION_KEY2, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        });
        const decrypted2 = CryptoJS.AES.decrypt(decrypted1.toString(CryptoJS.enc.Utf8), ENCRYPTION_KEY1, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        });
        const plain = decrypted2.toString(CryptoJS.enc.Utf8);
        if (!plain) {
            throw new Error("Failed to decrypt text");
        }
        return plain;
    } catch (error) {
        console.error('Decryption error:', error);
        throw error;
    }
};

export const encryptPasswordForStorage = async (password) => {
    try {
        const saltRounds = parseInt(process.env.SALT_ROUNDS, 10) || 10;
        return await bcrypt.hash(password, saltRounds);
    } catch (error) {
        console.error('Password encryption error:', error);
        throw error;
    }
};

export const verifyPassword = async (plainPassword, hashedPassword) => {
    try {
        return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
        console.error('Password verification error:', error);
        throw error;
    }
};