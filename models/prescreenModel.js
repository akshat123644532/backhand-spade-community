import { db } from '../config/db.js';

const Prescreen = {

    create: async (data) => {
        const { language, question_title, question_type, right_answer, status, sort_order } = data;
        const [result] = await db.execute(
            `INSERT INTO prescreens (language, question_title, question_type, right_answer, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
            [language, question_title, question_type || 'textbox', right_answer || null, status || 'active', sort_order ?? 0]
        );
        return result.insertId;
    },

    addOptions: async (prescreen_id, options) => {
        for (const option of options) {
            await db.execute(
                `INSERT INTO prescreen_options (prescreen_id, option_text) VALUES (?, ?)`,
                [prescreen_id, option]
            );
        }
    },

    deleteOptions: async (prescreen_id) => {
        await db.execute(`DELETE FROM prescreen_options WHERE prescreen_id = ?`, [prescreen_id]);
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', language = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND question_title LIKE ?`;
            params.push(`%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }
        if (language) {
            where += ` AND language = ?`;
            params.push(language);
        }

        const [rows] = await db.query(
            `SELECT id, language, question_title, question_type, sort_order, right_answer, status, created_at 
             FROM prescreens ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM prescreens ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM prescreens WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        if (!rows[0]) return null;

        const [options] = await db.execute(
            `SELECT id, option_text FROM prescreen_options WHERE prescreen_id = ?`, [id]
        );

        return { ...rows[0], options };
    },

    getByLanguage: async (language) => {
        const [rows] = await db.execute(
            `SELECT p.id, p.question_title, p.question_type, p.sort_order, p.right_answer,
             JSON_ARRAYAGG(po.option_text) as options
             FROM prescreens p
             LEFT JOIN prescreen_options po ON p.id = po.prescreen_id
             WHERE p.language = ? AND p.deleted_at IS NULL AND p.status = 'active'
             GROUP BY p.id
             ORDER BY p.sort_order ASC`,
            [language]
        );
        return rows;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE prescreens SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE prescreens SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    updateSortOrder: async (items) => {
        for (const item of items) {
            await db.execute(
                `UPDATE prescreens SET sort_order = ?, updated_at = NOW() WHERE id = ?`,
                [item.sort_order, item.id]
            );
        }
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE prescreens SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default Prescreen;