import { db } from '../config/db.js';

const QuestionLibrary = {

    create: async (data) => {
        const { language, question_title, question_type, options, right_answer, status, sort_order } = data;
        const [result] = await db.execute(
            `INSERT INTO question_library (language, question_title, question_type, options, right_answer, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [language, question_title, question_type || 'textbox', JSON.stringify(options || []), right_answer || null, status || 'active', sort_order ?? 0]
        );
        return result.insertId;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', language = '', question_type = '' } = {}) => {
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
        if (question_type) {
            where += ` AND question_type = ?`;
            params.push(question_type);
        }

        const [rows] = await db.query(
            `SELECT id, language, question_title, question_type, options, sort_order, right_answer, status, created_at 
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
        return rows[0] || null;
    },

    getByLanguage: async (language) => {
        const [rows] = await db.execute(
            `SELECT id, question_title, question_type, sort_order, right_answer, options
             FROM question_library
             WHERE language = ? AND deleted_at IS NULL AND status = 'active'
             ORDER BY sort_order ASC`,
            [language]
        );
        return rows;
    },

    update: async (id, data) => {
        const fields = [];
        const values = [];

        for (const key of Object.keys(data)) {
            if (key === 'options') {
                fields.push('options = ?');
                values.push(JSON.stringify(data.options || []));
            } else {
                fields.push(`${key} = ?`);
                values.push(data[key]);
            }
        }

        values.push(id);
        const [result] = await db.execute(
            `UPDATE question_library SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            values
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