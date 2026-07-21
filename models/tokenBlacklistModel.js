import { db } from '../config/db.js';

const TokenBlacklist = {
    add: async (token, expiresAt) => {
        await db.execute(
            `INSERT IGNORE INTO token_blacklist (token, expires_at) VALUES (?, ?)`,
            [token, expiresAt]
        );
    },

    isBlacklisted: async (token) => {
        const [rows] = await db.execute(
            `SELECT id FROM token_blacklist WHERE token = ? AND expires_at > NOW()`,
            [token]
        );
        return rows.length > 0;
    },

    cleanupExpired: async () => {
        await db.execute(`DELETE FROM token_blacklist WHERE expires_at <= NOW()`);
    }
};

export default TokenBlacklist;