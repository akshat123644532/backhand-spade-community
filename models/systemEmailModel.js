import { db } from '../config/db.js';

const SystemEmail = {

    getAll: async () => {
        const [rows] = await db.execute(
            `SELECT id, name, slug FROM system_emails ORDER BY id ASC`
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM system_emails WHERE id = ?`, [id]
        );
        return rows[0] || null;
    },

    getBySlug: async (slug) => {
        const [rows] = await db.execute(
            `SELECT * FROM system_emails WHERE slug = ?`, [slug]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE system_emails SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM system_emails WHERE id = ?`, [id]
        );
        return result;
    }
};

export default SystemEmail;