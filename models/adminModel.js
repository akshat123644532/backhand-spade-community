import { db } from '../config/db.js';

const Admin = {
    findByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, password, permission_type, permissions, image_url, image_mime_type, image_file_name, status, contact_no, token FROM admins WHERE email = ?`,
            [email]
        );
        return rows[0];
    },

    create: async (adminData) => {
        const { name, email, password, permission_type, permissions, image_url, image_mime_type, image_file_name, status, contact_no } = adminData;
        const [result] = await db.execute(
            `INSERT INTO admins (name, email, password, permission_type, permissions, image_url, image_mime_type, image_file_name, status, contact_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, email, password, permission_type, permissions ?? null, image_url, image_mime_type ?? null, image_file_name ?? null, status, contact_no]
        );
        return result;
    },

    update: async (id, updateData) => {
        const { name, permission_type, permissions, image_url, image_mime_type, image_file_name, status, updated_by } = updateData;

        const sets = [];
        const values = [];

        if (name !== undefined) { sets.push('name = ?'); values.push(name); }
        if (permission_type !== undefined) { sets.push('permission_type = ?'); values.push(permission_type); }
        if (permissions !== undefined) { sets.push('permissions = ?'); values.push(permissions ?? null); }
        if (status !== undefined) { sets.push('status = ?'); values.push(status); }
        if (updated_by !== undefined) { sets.push('updated_by = ?'); values.push(updated_by); }
        if (image_url !== undefined) { sets.push('image_url = ?'); values.push(image_url); }
        if (image_mime_type !== undefined) { sets.push('image_mime_type = ?'); values.push(image_mime_type); }
        if (image_file_name !== undefined) { sets.push('image_file_name = ?'); values.push(image_file_name); }

        if (!sets.length) return null; // nothing to update

        values.push(id);
        const [result] = await db.execute(
            `UPDATE admins SET ${sets.join(', ')} WHERE id = ?`,
            values
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

        const sql = `SELECT id, name, email, permission_type, permissions, image_url, image_mime_type, image_file_name, status, contact_no FROM admins ${where} ORDER BY id DESC LIMIT ? OFFSET ?`;

        const [rows] = await db.query(sql, [...params, Number(l), Number(offset)]);
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM admins ${where}`, params);

        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getByIdWithPassword: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, password FROM admins WHERE id = ?`,
            [id]
        );
        return rows[0];
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, permission_type, permissions, image_url, image_mime_type, image_file_name, status, contact_no FROM admins WHERE id = ?`,
            [id]
        );
        return rows[0];
    }
};

export default Admin;