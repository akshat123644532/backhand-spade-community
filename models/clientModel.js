import { db } from '../config/db.js';

const Client = {
    create: async (clientData) => {
        const { name, email, country, contact_no, admin_id, website_url, api_base_url, api_secret_key, api_body, status } = clientData;
        const [result] = await db.execute(
            `INSERT INTO PaperWardb.clients (name, email, country, contact_no, admin_id, website_url, api_base_url, api_secret_key, api_body, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name || null, email || null, country || null, contact_no || null, admin_id || null, website_url || null, api_base_url || null, api_secret_key || null, api_body || null, status || 'active']
        );
        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', country = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.contact_no LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (country) {
            where += ` AND c.country = ?`;
            params.push(country);
        }

        const [rows] = await db.query(
            `SELECT c.id, c.name, c.email, c.country, c.contact_no, c.website_url, c.status, c.created_at, c.admin_id, a.name AS admin_name
             FROM PaperWardb.clients c
             LEFT JOIN PaperWardb.admins a ON c.admin_id = a.id
             ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM PaperWardb.clients c ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT c.id, c.name, c.email, c.country, c.contact_no, c.website_url, c.api_base_url, c.api_secret_key, c.api_body, c.status, c.created_at, c.admin_id, a.name AS admin_name
             FROM PaperWardb.clients c
             LEFT JOIN PaperWardb.admins a ON c.admin_id = a.id
             WHERE c.id = ?`,
            [id]
        );
        return rows[0];
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(`SELECT id, email FROM PaperWardb.clients WHERE email = ?`, [email]);
        return rows[0];
    },

    update: async (id, updateData) => {
        const { name, country, contact_no, website_url, api_base_url, api_secret_key, api_body, status } = updateData;
        const fields = [];
        const values = [];

        if (name !== undefined) { fields.push('name = ?'); values.push(name); }
        if (country !== undefined) { fields.push('country = ?'); values.push(country); }
        if (contact_no !== undefined) { fields.push('contact_no = ?'); values.push(contact_no); }
        if (website_url !== undefined) { fields.push('website_url = ?'); values.push(website_url); }
        if (api_base_url !== undefined) { fields.push('api_base_url = ?'); values.push(api_base_url); }
        if (api_secret_key !== undefined) { fields.push('api_secret_key = ?'); values.push(api_secret_key); }
        if (api_body !== undefined) { fields.push('api_body = ?'); values.push(api_body); }
        if (status !== undefined) { fields.push('status = ?'); values.push(status); }

        values.push(id);

        const [result] = await db.execute(
            `UPDATE PaperWardb.clients SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(`DELETE FROM PaperWardb.clients WHERE id = ?`, [id]);
        return result;
    }
};

export default Client;