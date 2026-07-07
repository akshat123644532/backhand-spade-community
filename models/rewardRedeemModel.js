import { db } from '../config/db.js';

const RewardRedeem = {

    create: async (data) => {
        const { user_id, reward_points, requested_by, remark, comment } = data;
        const [result] = await db.execute(
            `INSERT INTO reward_redeem_requests (user_id, reward_points, requested_by, remark, comment)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, reward_points, requested_by || null, remark || null, comment || null]
        );
        return result.insertId;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', start_date = '', end_date = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (p.name LIKE ? OR rrr.requested_by LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND rrr.status = ?`;
            params.push(status);
        }
        if (start_date) {
            where += ` AND DATE(rrr.created_at) >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            where += ` AND DATE(rrr.created_at) <= ?`;
            params.push(end_date);
        }

        const [rows] = await db.query(
            `SELECT rrr.*, p.name AS user_name, p.email AS user_email
             FROM reward_redeem_requests rrr
             LEFT JOIN panelists p ON rrr.user_id = p.id
             ${where}
             ORDER BY rrr.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reward_redeem_requests rrr
             LEFT JOIN panelists p ON rrr.user_id = p.id ${where}`, params
        );

        return {
            data: rows,
            total: countResult[0].total || 0,
            page: p,
            limit: l,
            totalPages: Math.ceil((countResult[0].total || 0) / l)
        };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT rrr.*, p.name AS user_name, p.email AS user_email
             FROM reward_redeem_requests rrr
             LEFT JOIN panelists p ON rrr.user_id = p.id
             WHERE rrr.id = ?`, [id]
        );
        return rows[0] || null;
    },

    updateStatus: async (id, data) => {
        const { status, action_by, remark, comment } = data;
        const [result] = await db.execute(
            `UPDATE reward_redeem_requests SET status = ?, action_by = ?, action_date = NOW(), remark = ?, comment = ?, updated_at = NOW() WHERE id = ?`,
            [status, action_by || null, remark || null, comment || null, id]
        );
        return result;
    }
};

export default RewardRedeem;