import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import CryptoJS from "crypto-js";

dotenv.config();

const ENCRYPTION_KEY1 = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY1);
const ENCRYPTION_KEY2 = CryptoJS.enc.Hex.parse(process.env.ENCRYPTION_KEY2);

if (!process.env.ENCRYPTION_KEY1 || !process.env.ENCRYPTION_KEY2) {
    throw new Error("ENCRYPTION_KEY1 and ENCRYPTION_KEY2 must be set in .env");
}

export const encrypt = (text) => {
    if (typeof text !== "string") {
        throw new Error("Input text must be a string");
    }
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
};

export const decrypt = (encryptedText) => {
    if (typeof encryptedText !== "string") {
        throw new Error("Encrypted text must be a string");
    }
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
};

export const encryptPasswordForStorage = async (password) => {
    const saltRounds = parseInt(process.env.SALT_ROUNDS, 10) || 10;
    return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (plainPassword, hashedPassword) => {
    return bcrypt.compare(plainPassword, hashedPassword);
};
