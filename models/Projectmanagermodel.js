import { db } from '../config/db.js';

const ProjectManager = {

    generateCode: async () => {
        const [rows] = await db.execute(`SELECT code FROM project_managers ORDER BY id DESC LIMIT 1`);
        if (!rows.length) return 'PM001';
        const num = parseInt(rows[0].code.replace('PM', '')) + 1;
        return `PM${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const { code, name, email, password, profile_image } = data;
        const [result] = await db.execute(
            `INSERT INTO project_managers (code, name, email, password, profile_image) VALUES (?, ?, ?, ?, ?)`,
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

        // FIX: LIMIT aur OFFSET ke liye db.query ka use kiya hai
        // db.execute yahan strict type checking ke karan fail ho raha tha
        const sql = `SELECT id, code, name, email, profile_image, status, created_at FROM project_managers ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        
        // LIMIT aur OFFSET ko strictly Number mein convert karke bheja hai
        const [rows] = await db.query(sql, [...params, Number(l), Number(offset)]);
        
        // Total count nikalne ke liye
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM project_managers ${where}`, params);
        const total = countResult[0].total || 0;

        return { 
            data: rows, 
            total: total, 
            page: p, 
            limit: l, 
            totalPages: Math.ceil(total / l) 
        };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, code, name, email, profile_image, status, created_at FROM project_managers WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(`SELECT id FROM project_managers WHERE email = ? AND deleted_at IS NULL`, [email]);
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(`UPDATE project_managers SET ${fields}, updated_at = NOW() WHERE id = ?`, [...Object.values(data), id]);
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(`UPDATE project_managers SET status = ?, updated_at = NOW() WHERE id = ?`, [status, id]);
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(`UPDATE project_managers SET deleted_at = NOW() WHERE id = ?`, [id]);
        return result;
    }
};

export default ProjectManager;