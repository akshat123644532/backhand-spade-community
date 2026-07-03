import { db } from '../config/db.js';

const EmailTemplate = {

    create: async (data) => {
        const { template_key, slug, title, description, subject, body, status } = data;
        const [result] = await db.execute(
            `INSERT INTO email_templates (template_key, slug, title, description, subject, body, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [template_key, slug || template_key, title, description || null, subject, body, status || 'active']
        );
        return result.insertId;
    },

    getAll: async ({ page = 1, limit = 20, search = '', status = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 20;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (title LIKE ? OR template_key LIKE ? OR slug LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }

        const [rows] = await db.query(
            `SELECT * FROM email_templates ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM email_templates ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM email_templates WHERE id = ?`, [id]);
        return rows[0] || null;
    },

    getByKey: async (template_key) => {
        const [rows] = await db.execute(`SELECT * FROM email_templates WHERE template_key = ? AND status = 'active'`, [template_key]);
        return rows[0] || null;
    },

    getBySlug: async (slug) => {
        const [rows] = await db.execute(`SELECT * FROM email_templates WHERE slug = ? AND status = 'active'`, [slug]);
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = [];
        const values = [];

        for (const key of Object.keys(data)) {
            fields.push(`${key} = ?`);
            values.push(data[key]);
        }
        values.push(id);

        const [result] = await db.execute(
            `UPDATE email_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            values
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(`DELETE FROM email_templates WHERE id = ?`, [id]);
        return result;
    },

    // replaces {placeholder} with actual values -> returns { subject, body } ready to send
    render: (template, data = {}) => {
        let subject = template.subject;
        let body = template.body;

        for (const key of Object.keys(data)) {
            const pattern = new RegExp(`{${key}}`, 'g');
            subject = subject.replace(pattern, data[key]);
            body = body.replace(pattern, data[key]);
        }

        return { subject, body };
    }
};

export default EmailTemplate;