import { db } from '../config/db.js';

const DB_NAME = process.env.DB_NAME || 'PaperWardb';

const buildUpdateQuery = (table, updateData, whereClause, whereParams = []) => {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    }

    if (fields.length === 0) {
        throw new Error("No fields provided to update!");
    }

    const sql = `UPDATE ${table} SET ${fields.join(', ')} WHERE ${whereClause}`;
    return { sql, values: [...values, ...whereParams] };
};

const Client = {
    create: async (clientData) => {
        const { name, email, country, contact_no, admin_id, website_url, api_base_url, api_secret_key, api_header_key, status } = clientData;

        const [result] = await db.execute(
            `INSERT INTO ${DB_NAME}.clients (name, email, country, contact_no, admin_id, website_url, api_base_url, api_secret_key, api_header_key, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name || null, email || null, country || null, contact_no || null, admin_id || null, website_url || null, api_base_url || null, api_secret_key || null, api_header_key || null, status || 'active']
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
             FROM ${DB_NAME}.clients c
             LEFT JOIN ${DB_NAME}.admins a ON c.admin_id = a.id
             ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM ${DB_NAME}.clients c ${where}`,
            params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT c.id, c.name, c.email, c.country, c.contact_no, c.website_url, c.api_base_url, c.api_secret_key, c.api_header_key, c.status, c.created_at, c.admin_id, a.name AS admin_name
             FROM ${DB_NAME}.clients c
             LEFT JOIN ${DB_NAME}.admins a ON c.admin_id = a.id
             WHERE c.id = ?`,
            [id]
        );
        return rows[0];
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT id, email FROM ${DB_NAME}.clients WHERE email = ?`,
            [email]
        );
        return rows[0];
    },

    update: async (id, updateData) => {
        const { name, country, contact_no, website_url, api_base_url, api_secret_key, api_header_key, status } = updateData;

        const { sql, values } = buildUpdateQuery(
            `${DB_NAME}.clients`,
            { name, country, contact_no, website_url, api_base_url, api_secret_key, api_header_key, status },
            `id = ?`,
            [id]
        );

        const [result] = await db.execute(sql, values);
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM ${DB_NAME}.clients WHERE id = ?`,
            [id]
        );
        return result;
    }
};

export default Client;