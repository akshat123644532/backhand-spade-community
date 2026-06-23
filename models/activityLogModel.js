import { db } from '../config/db.js';

const ActivityLog = {

    getAll: async ({ page = 1, limit = 10, search = '', module = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (al.action LIKE ? OR al.description LIKE ? OR a.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (module) {
            where += ` AND al.module = ?`;
            params.push(module);
        }

        const [rows] = await db.query(
            `SELECT al.id, al.action, al.module, al.description, al.ip_address, al.created_at,
             a.name AS admin_name, a.email AS admin_email
             FROM activity_logs al
             LEFT JOIN admins a ON al.admin_id = a.id
             ${where}
             ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM activity_logs al
             LEFT JOIN admins a ON al.admin_id = a.id
             ${where}`, params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    delete: async (id) => {
        const [result] = await db.execute(`DELETE FROM activity_logs WHERE id = ?`, [id]);
        return result;
    },

    deleteAll: async () => {
        const [result] = await db.execute(`DELETE FROM activity_logs`);
        return result;
    }
};

export default ActivityLog;