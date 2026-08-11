import { db } from '../config/db.js';

const Message = {

    create: async (data) => {
        const { sender_name, sender_email, subject, body, recipient_admin_id } = data;
        const [result] = await db.execute(
            `INSERT INTO messages (sender_name, sender_email, subject, body, recipient_admin_id)
             VALUES (?, ?, ?, ?, ?)`,
            [sender_name, sender_email, subject, body, recipient_admin_id || null]
        );
        return result.insertId;
    },

    getAll: async ({ page = 1, limit = 10, search = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND (sender_name LIKE ? OR subject LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        const [rows] = await db.query(
            `SELECT id, sender_name, sender_email, subject, is_read, created_at
             FROM messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM messages ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getUnreadCount: async () => {
        const [rows] = await db.execute(
            `SELECT COUNT(*) as count FROM messages WHERE is_read = 0 AND deleted_at IS NULL`
        );
        return rows[0].count || 0;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    markRead: async (id) => {
        const [result] = await db.execute(
            `UPDATE messages SET is_read = 1, updated_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    },

    markAllRead: async () => {
        const [result] = await db.execute(
            `UPDATE messages SET is_read = 1, updated_at = NOW() WHERE is_read = 0 AND deleted_at IS NULL`
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE messages SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    },

    addReply: async ({ message_id, reply_body, replied_by }) => {
        const [result] = await db.execute(
            `INSERT INTO message_replies (message_id, reply_body, replied_by) VALUES (?, ?, ?)`,
            [message_id, reply_body, replied_by || null]
        );
        return result.insertId;
    },

    getReplies: async (message_id) => {
        const [rows] = await db.execute(
            `SELECT * FROM message_replies WHERE message_id = ? ORDER BY created_at ASC`,
            [message_id]
        );
        return rows;
    }
};

export default Message;