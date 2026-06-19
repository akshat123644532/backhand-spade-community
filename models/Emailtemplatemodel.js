import { db } from '../config/db.js';

const EmailTemplate = {

    getAll: async () => {
        const [rows] = await db.execute(
            `SELECT id, title, slug FROM email_templates ORDER BY id ASC`
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM email_templates WHERE id = ?`, [id]
        );
        return rows[0] || null;
    },

    getBySlug: async (slug) => {
        const [rows] = await db.execute(
            `SELECT * FROM email_templates WHERE slug = ?`, [slug]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE email_templates SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    }
};

export default EmailTemplate;