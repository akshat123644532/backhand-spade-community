import { db } from '../config/db.js';

const RewardTransaction = {

    create: async (data) => {
        const { user_id, reward_points, transaction_type, transaction_by, remark, reference_id, status, comment } = data;
        const [result] = await db.execute(
            `INSERT INTO reward_transactions (user_id, reward_points, transaction_type, transaction_by, remark, reference_id, status, comment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id, reward_points, transaction_type, transaction_by || null, remark || null, reference_id || null, status || 'completed', comment || null]
        );
        return result.insertId;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', transaction_type = '', start_date = '', end_date = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (p.name LIKE ? OR rt.remark LIKE ? OR rt.reference_id LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND rt.status = ?`;
            params.push(status);
        }
        if (transaction_type) {
            where += ` AND rt.transaction_type = ?`;
            params.push(transaction_type);
        }
        if (start_date) {
            where += ` AND DATE(rt.created_at) >= ?`;
            params.push(start_date);
        }
        if (end_date) {
            where += ` AND DATE(rt.created_at) <= ?`;
            params.push(end_date);
        }

        const [rows] = await db.query(
            `SELECT rt.*, p.name AS user_name, p.email AS user_email
             FROM reward_transactions rt
             LEFT JOIN panelists p ON rt.user_id = p.id
             ${where}
             ORDER BY rt.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reward_transactions rt
             LEFT JOIN panelists p ON rt.user_id = p.id ${where}`, params
        );

        const [summary] = await db.query(
            `SELECT
                SUM(CASE WHEN rt.transaction_type = 'credit' THEN rt.reward_points ELSE 0 END) AS total_credit,
                SUM(CASE WHEN rt.transaction_type = 'debit' THEN rt.reward_points ELSE 0 END) AS total_debit
             FROM reward_transactions rt
             LEFT JOIN panelists p ON rt.user_id = p.id ${where}`, params
        );

        return {
            data: rows,
            total: countResult[0].total || 0,
            page: p,
            limit: l,
            totalPages: Math.ceil((countResult[0].total || 0) / l),
            summary: {
                total_credit: summary[0].total_credit || 0,
                total_debit: summary[0].total_debit || 0,
                total_balance: (summary[0].total_credit || 0) - (summary[0].total_debit || 0)
            }
        };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT rt.*, p.name AS user_name, p.email AS user_email
             FROM reward_transactions rt
             LEFT JOIN panelists p ON rt.user_id = p.id
             WHERE rt.id = ?`, [id]
        );
        return rows[0] || null;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM reward_transactions WHERE id = ?`, [id]
        );
        return result;
    }
};

export default RewardTransaction;