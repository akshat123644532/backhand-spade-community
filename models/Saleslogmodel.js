import { db } from '../config/db.js';

const SalesLog = {

    create: async (data) => {
        const { project_id, email_subject, comment, comment_by, created_by } = data;
        const [result] = await db.execute(
            `INSERT INTO sales_logs (project_id, email_subject, comment, comment_by, created_by)
             VALUES (?, ?, ?, ?, ?)`,
            [project_id, email_subject || null, comment || null, comment_by || 'Sales', created_by || null]
        );
        return result;
    },

    getByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT 
                sl.id, sl.project_id, sl.email_subject, sl.comment,
                sl.comment_by, sl.created_at,
                au.name AS created_by_name
             FROM sales_logs sl
             LEFT JOIN admin_users au ON sl.created_by = au.id
             WHERE sl.project_id = ? AND sl.deleted_at IS NULL
             ORDER BY sl.created_at DESC`,
            [project_id]
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM sales_logs WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const { email_subject, comment, comment_by } = data;
        const [result] = await db.execute(
            `UPDATE sales_logs SET email_subject = ?, comment = ?, comment_by = ?, updated_at = NOW()
             WHERE id = ?`,
            [email_subject || null, comment || null, comment_by || 'Sales', id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE sales_logs SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default SalesLog;