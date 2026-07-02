import { db } from '../config/db.js';

const PanelQuestionnaire = {

    create: async (data) => {
        const { language, question_title, question_text, question_type, options, is_required, sort_order, status } = data;
        const [result] = await db.execute(
            `INSERT INTO panel_questionnaire (language, question_title, question_text, question_type, options, is_required, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [language, question_title, question_text, question_type || 'textbox', JSON.stringify(options || []), is_required || 0, sort_order ?? 0, status || 'active']
        );
        return result.insertId;
    },

    getAll: async ({ page = 1, limit = 15, search = '', status = '', language = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 15;
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
            `SELECT id, language, question_title, question_text, question_type, options, sort_order, status
             FROM panel_questionnaire ${where} 
             ORDER BY question_title ASC, sort_order ASC 
             LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM panel_questionnaire ${where}`, params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM panel_questionnaire WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    getByTitle: async (question_title) => {
        const [rows] = await db.execute(
            `SELECT id, language, question_title, question_text, question_type, options, is_required, sort_order, status, created_at
             FROM panel_questionnaire WHERE question_title = ? AND deleted_at IS NULL ORDER BY sort_order ASC`,
            [question_title]
        );
        if (!rows.length) return null;

        return { question_title, language: rows[0].language, questions: rows };
    },

    getByLanguage: async (language) => {
        const [rows] = await db.execute(
            `SELECT id, question_title, question_text, options
             FROM panel_questionnaire 
             WHERE language = ? AND deleted_at IS NULL AND status = 'active'
             ORDER BY question_title ASC, sort_order ASC`,
            [language]
        );

        const grouped = {};
        for (const row of rows) {
            const key = row.question_title;
            if (!grouped[key]) {
                grouped[key] = {
                    question_title: key,
                    questions: []
                };
            }
            grouped[key].questions.push({
                id: row.id,
                question_text: row.question_text,
                options: row.options
            });
        }

        return Object.values(grouped);
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
            `UPDATE panel_questionnaire SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            values
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE panel_questionnaire SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    updateSortOrder: async (items) => {
        for (const item of items) {
            await db.execute(
                `UPDATE panel_questionnaire SET sort_order = ?, updated_at = NOW() WHERE id = ?`,
                [item.sort_order, item.id]
            );
        }
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE panel_questionnaire SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default PanelQuestionnaire;