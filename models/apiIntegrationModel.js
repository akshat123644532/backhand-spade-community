import { db } from '../config/db.js';
import { decrypt, encrypt } from '../utils/cryptoHelper.js';

const TABLE = 'api_integrations';

const ensureTable = async () => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            api_name VARCHAR(120) NOT NULL UNIQUE,
            api_user_id TEXT NULL,
            api_key TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
};

const maskSecret = (value) => {
    const text = String(value ?? '');
    if (!text) return '';
    if (text.length <= 4) return '••••';
    return `${'•'.repeat(Math.min(12, text.length - 4))}${text.slice(-4)}`;
};

const safeDecrypt = (value) => {
    if (!value) return '';
    try {
        return decrypt(String(value));
    } catch {
        // Legacy/plaintext rows
        return String(value);
    }
};

const toPublicRecord = (row, { reveal = false } = {}) => {
    if (!row) return null;
    const userId = safeDecrypt(row.api_user_id);
    const apiKey = safeDecrypt(row.api_key);

    return {
        id: row.id,
        api_name: row.api_name,
        api_user_id: reveal ? userId : maskSecret(userId),
        api_key: reveal ? apiKey : maskSecret(apiKey),
        has_api_user_id: Boolean(userId),
        has_api_key: Boolean(apiKey),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
};

const ApiIntegration = {
    ensureTable,

    list: async ({ reveal = false } = {}) => {
        await ensureTable();
        const [rows] = await db.execute(
            `SELECT id, api_name, api_user_id, api_key, created_at, updated_at
             FROM ${TABLE}
             ORDER BY api_name ASC`
        );
        return rows.map((row) => toPublicRecord(row, { reveal }));
    },

    getByName: async (apiName, { reveal = false } = {}) => {
        await ensureTable();
        const name = String(apiName ?? '').trim();
        if (!name) return null;
        const [rows] = await db.execute(
            `SELECT id, api_name, api_user_id, api_key, created_at, updated_at
             FROM ${TABLE}
             WHERE api_name = ?
             LIMIT 1`,
            [name]
        );
        return toPublicRecord(rows[0] || null, { reveal });
    },

    /** Internal use (Scamalytics service) — returns plaintext credentials. */
    getSecretsByName: async (apiName) => {
        await ensureTable();
        const name = String(apiName ?? '').trim();
        if (!name) return null;
        const [rows] = await db.execute(
            `SELECT api_name, api_user_id, api_key FROM ${TABLE} WHERE api_name = ? LIMIT 1`,
            [name]
        );
        const row = rows[0];
        if (!row) return null;
        return {
            api_name: row.api_name,
            api_user_id: safeDecrypt(row.api_user_id),
            api_key: safeDecrypt(row.api_key),
        };
    },

    upsert: async ({ api_name, api_user_id, api_key }) => {
        await ensureTable();
        const name = String(api_name ?? '').trim();
        if (!name) {
            throw new Error('API name is required');
        }

        const [existingRows] = await db.execute(
            `SELECT id, api_user_id, api_key FROM ${TABLE} WHERE api_name = ? LIMIT 1`,
            [name]
        );
        const existing = existingRows[0] || null;

        let nextUserId = existing?.api_user_id ?? null;
        if (api_user_id !== undefined && api_user_id !== null) {
            const trimmed = String(api_user_id).trim();
            nextUserId = trimmed ? encrypt(trimmed) : null;
        }

        let nextApiKey = existing?.api_key ?? null;
        if (api_key !== undefined && api_key !== null) {
            const trimmed = String(api_key).trim();
            // Ignore masked placeholders from the UI (••••abcd)
            const looksMasked = /^[•*]+/.test(trimmed) && !trimmed.includes(' ');
            if (!looksMasked) {
                nextApiKey = trimmed ? encrypt(trimmed) : null;
            }
        }

        if (existing) {
            await db.execute(
                `UPDATE ${TABLE}
                 SET api_user_id = ?, api_key = ?, updated_at = NOW()
                 WHERE api_name = ?`,
                [nextUserId, nextApiKey, name]
            );
        } else {
            await db.execute(
                `INSERT INTO ${TABLE} (api_name, api_user_id, api_key) VALUES (?, ?, ?)`,
                [name, nextUserId, nextApiKey]
            );
        }

        return ApiIntegration.getByName(name, { reveal: false });
    },
};

export default ApiIntegration;
