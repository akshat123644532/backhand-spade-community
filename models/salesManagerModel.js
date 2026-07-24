import { db } from '../config/db.js';
import { buildUpdateQuery } from '../utils/sqlHelper.js';

const SalesManager = {

    generateCode: async () => {
        const [rows] = await db.execute(`SELECT code FROM sales_managers ORDER BY id DESC LIMIT 1`);
        if (!rows.length) return 'SM001';
        const num = parseInt(rows[0].code.replace('SM', '')) + 1;
        return `SM${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const { code, name, email, password, profile_image } = data;
        const [result] = await db.execute(
            `INSERT INTO sales_managers (code, name, email, password, profile_image) VALUES (?, ?, ?, ?, ?)`,
            [code, name, email, password, profile_image || null]
        );
        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;

        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND (name LIKE ? OR email LIKE ? OR code LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }

        const sql = `SELECT id, code, name, email, profile_image, status, created_at FROM sales_managers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;

        const [rows] = await db.query(sql, [...params, Number(l), Number(offset)]);
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM sales_managers ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, code, name, email, profile_image, status, created_at FROM sales_managers WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(`SELECT id FROM sales_managers WHERE email = ? AND deleted_at IS NULL`, [email]);
        return rows[0] || null;
    },

    // Login ke liye alag method — password aur status bhi chahiye
    findByEmailForLogin: async (email) => {
        const [rows] = await db.execute(
            `SELECT id, code, name, email, password, profile_image, status FROM sales_managers WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const { sql, values } = buildUpdateQuery('sales_managers', data, 'id = ?', [id], 'updated_at = NOW()');
        const [result] = await db.execute(sql, values);
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(`UPDATE sales_managers SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(`UPDATE sales_managers SET deleted_at = NOW() WHERE id = ?`, [id]);
        return result;
    }
};

export default SalesManager;