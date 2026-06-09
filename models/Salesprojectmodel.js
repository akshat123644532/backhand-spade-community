import { db } from '../config/db.js';

const SalesProject = {

    generateProjectId: async () => {
        const [rows] = await db.execute(`SELECT project_id FROM sales_projects ORDER BY id DESC LIMIT 1`);
        if (!rows.length) return 'PRJ001';
        const last = rows[0].project_id.replace('PRJ', '');
        const num = parseInt(last) + 1;
        return `PRJ${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const { project_id, client_name, email, country, email_subject, status, comment, created_by } = data;
        const [result] = await db.execute(
            `INSERT INTO sales_projects (project_id, client_name, email, country, email_subject, status, comment, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [project_id, client_name, email, country || null, email_subject || null, status || 'pending', comment || null, created_by || null]
        );
        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', country = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND (client_name LIKE ? OR email LIKE ? OR project_id LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }
        if (country) {
            where += ` AND country = ?`;
            params.push(country);
        }

        const [rows] = await db.query(
            `SELECT id, project_id, client_name, email, country, status, created_at FROM sales_projects ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM sales_projects ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM sales_projects WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT id FROM sales_projects WHERE email = ? AND deleted_at IS NULL`, [email]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE sales_projects SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE sales_projects SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default SalesProject;