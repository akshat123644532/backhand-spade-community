import { db } from '../config/db.js';

const QuestionnaireGroup = {

    create: async (data) => {
        const { group_title, language, status } = data;
        const [result] = await db.execute(
            `INSERT INTO questionnaire_groups (group_title, language, status) VALUES (?, ?, ?)`,
            [group_title, language, status || 'active']
        );
        return result.insertId;
    },

    addQuestions: async (questionnaire_group_id, question_library_ids) => {
        for (const question_library_id of question_library_ids) {
            await db.execute(
                `INSERT INTO questionnaire_group_questions (questionnaire_group_id, question_library_id) VALUES (?, ?)`,
                [questionnaire_group_id, question_library_id]
            );
        }
    },

    deleteQuestions: async (questionnaire_group_id) => {
        await db.execute(
            `DELETE FROM questionnaire_group_questions WHERE questionnaire_group_id = ?`,
            [questionnaire_group_id]
        );
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', language = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND group_title LIKE ?`;
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
            `SELECT id, group_title, language, status, created_at FROM questionnaire_groups ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM questionnaire_groups ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM questionnaire_groups WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        if (!rows[0]) return null;

        const [questions] = await db.execute(
            `SELECT ql.id, ql.question_title, ql.right_answer,
             JSON_ARRAYAGG(qlo.option_text) as options
             FROM questionnaire_group_questions qgq
             JOIN question_library ql ON qgq.question_library_id = ql.id
             LEFT JOIN question_library_options qlo ON ql.id = qlo.question_library_id
             WHERE qgq.questionnaire_group_id = ?
             GROUP BY ql.id`,
            [id]
        );

        return { ...rows[0], questions };
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE questionnaire_groups SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE questionnaire_groups SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE questionnaire_groups SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default QuestionnaireGroup;