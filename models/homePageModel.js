import { db } from '../config/db.js';

const HomePageSetting = {

    getAll: async () => {
        const [rows] = await db.execute(
            `SELECT section, field_key, field_value FROM home_page_settings ORDER BY section, id`
        );
        const result = {};
        for (const row of rows) {
            if (!result[row.section]) result[row.section] = {};
            result[row.section][row.field_key] = row.field_value;
        }
        return result;
    },

    getBySection: async (section) => {
        const [rows] = await db.execute(
            `SELECT field_key, field_value FROM home_page_settings WHERE section = ?`, [section]
        );
        if (!rows.length) return null;
        const result = {};
        for (const row of rows) {
            result[row.field_key] = row.field_value;
        }
        return { section, data: result };
    },

    upsertSection: async (section, fields) => {
        for (const [field_key, field_value] of Object.entries(fields)) {
            await db.execute(
                `INSERT INTO home_page_settings (section, field_key, field_value)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE field_value = VALUES(field_value), updated_at = NOW()`,
                [section, field_key, field_value]
            );
        }
    },

    deleteSection: async (section) => {
        const [result] = await db.execute(
            `DELETE FROM home_page_settings WHERE section = ?`, [section]
        );
        return result;
    },

    deleteField: async (section, field_key) => {
        const [result] = await db.execute(
            `DELETE FROM home_page_settings WHERE section = ? AND field_key = ?`,
            [section, field_key]
        );
        return result;
    }
};

export default HomePageSetting;