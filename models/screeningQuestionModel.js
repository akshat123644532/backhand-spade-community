import { db } from '../config/db.js';

const ScreeningQuestion = {

    create: async (data) => {
        const { language, question_title, question_text, question_type, is_required, sort_order, status } = data;
        const [result] = await db.execute(
            `INSERT INTO screening_questions (language, question_title, question_text, question_type, is_required, sort_order, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [language, question_title, question_text, question_type || 'textbox', is_required || 0, sort_order ?? 0, status || 'active']
        );
        return result.insertId;
    },

    addOptions: async (question_id, options) => {
        for (const option of options) {
            await db.execute(
                `INSERT INTO screening_question_options (question_id, option_text) VALUES (?, ?)`,
                [question_id, option]
            );
        }
    },

    deleteOptions: async (question_id) => {
        await db.execute(`DELETE FROM screening_question_options WHERE question_id = ?`, [question_id]);
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
            `SELECT id, language, question_title, question_text, question_type, is_required, sort_order, status, created_at 
             FROM screening_questions ${where} ORDER BY question_title ASC, sort_order ASC`,
            [...params]
        );

        // Group by question_title
        const grouped = {};
        for (const row of rows) {
            const key = row.question_title;
            if (!grouped[key]) {
                grouped[key] = {
                    question_title: row.question_title,
                    language: row.language,
                    questions: []
                };
            }
            grouped[key].questions.push({
                id: row.id,
                question_text: row.question_text,
                question_type: row.question_type,
                is_required: row.is_required,
                sort_order: row.sort_order,
                status: row.status,
                created_at: row.created_at
            });
        }

        const data = Object.values(grouped);
        const total = data.length;
        const paginated = data.slice(offset, offset + l);

        return { data: paginated, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM screening_questions WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        if (!rows[0]) return null;

        const [options] = await db.execute(
            `SELECT id, option_text FROM screening_question_options WHERE question_id = ?`, [id]
        );

        return { ...rows[0], options };
    },

    getByTitle: async (question_title) => {
        const [rows] = await db.execute(
            `SELECT id, language, question_title, question_text, question_type, is_required, sort_order, status, created_at
             FROM screening_questions WHERE question_title = ? AND deleted_at IS NULL ORDER BY sort_order ASC`,
            [question_title]
        );
        if (!rows.length) return null;

        const questions = [];
        for (const row of rows) {
            const [options] = await db.execute(
                `SELECT id, option_text FROM screening_question_options WHERE question_id = ?`, [row.id]
            );
            questions.push({ ...row, options });
        }

        return { question_title, language: rows[0].language, questions };
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE screening_questions SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE screening_questions SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    updateSortOrder: async (items) => {
        for (const item of items) {
            await db.execute(
                `UPDATE screening_questions SET sort_order = ?, updated_at = NOW() WHERE id = ?`,
                [item.sort_order, item.id]
            );
        }
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE screening_questions SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default ScreeningQuestion;