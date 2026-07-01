import { db } from '../config/db.js';

const QuestionLibrary = {

    create: async (data) => {
        const { language, question_title, question_type, right_answer, status, sort_order } = data;
        const [result] = await db.execute(
            `INSERT INTO question_library (language, question_title, question_type, right_answer, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
            [language, question_title, question_type || 'textbox', right_answer || null, status || 'active', sort_order ?? 0]
        );
        return result.insertId;
    },

    addOptions: async (question_library_id, options) => {
        for (const option of options) {
            await db.execute(
                `INSERT INTO question_library_options (question_library_id, option_text) VALUES (?, ?)`,
                [question_library_id, option]
            );
        }
    },

    deleteOptions: async (question_library_id) => {
        await db.execute(`DELETE FROM question_library_options WHERE question_library_id = ?`, [question_library_id]);
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
             FROM question_library ${where} ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM question_library ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM question_library WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        if (!rows[0]) return null;

        const [options] = await db.execute(
            `SELECT id, option_text FROM question_library_options WHERE question_library_id = ?`, [id]
        );

        return { ...rows[0], options };
    },

    getByLanguage: async (language) => {
        const [rows] = await db.execute(
            `SELECT ql.id, ql.question_title, ql.question_type, ql.sort_order, ql.right_answer,
             JSON_ARRAYAGG(qlo.option_text) as options
             FROM question_library ql
             LEFT JOIN question_library_options qlo ON ql.id = qlo.question_library_id
             WHERE ql.language = ? AND ql.deleted_at IS NULL AND ql.status = 'active'
             GROUP BY ql.id
             ORDER BY ql.sort_order ASC`,
            [language]
        );
        return rows;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE question_library SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE question_library SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    updateSortOrder: async (items) => {
        for (const item of items) {
            await db.execute(
                `UPDATE question_library SET sort_order = ?, updated_at = NOW() WHERE id = ?`,
                [item.sort_order, item.id]
            );
        }
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE question_library SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default QuestionLibrary;