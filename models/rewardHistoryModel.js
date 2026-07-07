import { db } from '../config/db.js';

const RewardHistory = {

    create: async (data) => {
        const { user_id, reward_points, transaction_type, reward_type, status, remarks, created_by } = data;
        const [result] = await db.execute(
            `INSERT INTO reward_history (user_id, reward_points, transaction_type, reward_type, status, remarks, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user_id, reward_points, transaction_type, reward_type, status || 'pending', remarks || null, created_by || null]
        );
        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', start_date = '', end_date = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (p.name LIKE ? OR rh.reward_type LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND rh.status = ?`;
            params.push(status);
        }
        if (start_date) {
            where += ` AND DATE(rh.created_at) >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            where += ` AND DATE(rh.created_at) <= ?`;
            params.push(end_date);
        }

        const [rows] = await db.query(
            `SELECT rh.id, p.id AS user_id, p.name AS user_name, rh.reward_points,
                    rh.transaction_type, rh.reward_type, rh.status, rh.created_at
             FROM reward_history rh
             LEFT JOIN panelists p ON rh.user_id = p.id
             ${where}
             ORDER BY rh.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reward_history rh
             LEFT JOIN panelists p ON rh.user_id = p.id ${where}`,
            params
        );
        const total = countResult[0].total || 0;

        const [summary] = await db.query(
            `SELECT
                SUM(CASE WHEN rh.transaction_type = 'credit' THEN rh.reward_points ELSE 0 END) AS total_credit,
                SUM(CASE WHEN rh.transaction_type = 'debit' THEN rh.reward_points ELSE 0 END) AS total_debit
             FROM reward_history rh
             LEFT JOIN panelists p ON rh.user_id = p.id ${where}`,
            params
        );

        const total_credit = summary[0].total_credit || 0;
        const total_debit = summary[0].total_debit || 0;

        return {
            data: rows,
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l),
            summary: {
                total_credit,
                total_debit,
                total_balance: total_credit - total_debit
            }
        };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT rh.*, p.name AS user_name
             FROM reward_history rh
             LEFT JOIN panelists p ON rh.user_id = p.id
             WHERE rh.id = ?`,
            [id]
        );
        return rows[0] || null;
    }
};

export default RewardHistory;