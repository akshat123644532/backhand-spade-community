import { db } from '../config/db.js';

const Admin = {
    findByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, password, permission_type, permissions, image_url, status, contact_no, token FROM admins WHERE email = ?`,
            [email]
        );
        return rows[0];
    },

    create: async (adminData) => {
        const { name, email, password, permission_type, permissions, image_url, status, contact_no } = adminData;
        const [result] = await db.execute(
            `INSERT INTO admins (name, email, password, permission_type, permissions, image_url, status, contact_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, password, permission_type, permissions ?? null, image_url, status, contact_no]
        );
        return result;
    },

    update: async (id, updateData) => {
        const { name, permission_type, permissions, image_url, status, updated_by } = updateData;
        const [result] = await db.execute(
            `UPDATE admins SET name = ?, permission_type = ?, permissions = ?, image_url = ?, status = ?, updated_by = ? WHERE id = ?`,
            [name, permission_type, permissions ?? null, image_url, status, updated_by, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(`DELETE FROM admins WHERE id = ?`, [id]);
        return result;
    },

    updateToken: async (id, token) => {
        const [result] = await db.execute(`UPDATE admins SET token = ? WHERE id = ?`, [token, id]);
        return result;
    },

    updatePassword: async (email, hashedPassword) => {
        const [result] = await db.execute(`UPDATE admins SET password = ? WHERE email = ?`, [hashedPassword, email]);
        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (name LIKE ? OR email LIKE ? OR contact_no LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }

        const sql = `SELECT id, name, email, permission_type, permissions, image_url, status, contact_no FROM admins ${where} ORDER BY id DESC LIMIT ? OFFSET ?`;
        
        const [rows] = await db.query(sql, [...params, Number(l), Number(offset)]);
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM admins ${where}`, params);
        
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, permission_type, permissions, image_url, status, contact_no FROM admins WHERE id = ?`,
            [id]
        );
        return rows[0];
    }
};

export default Admin;