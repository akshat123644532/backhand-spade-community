import { db } from '../config/db.js';

const QuestionnaireGroup = {

    create: async (data) => {
        const { surveyTitle, language, status, questionIds } = data;
        const [result] = await db.execute(
            `INSERT INTO questionnaire_groups (surveyTitle, language, status, questionIds) VALUES (?, ?, ?, ?)`,
            [surveyTitle, language, status || 'active', JSON.stringify(questionIds || [])]
        );
        return result.insertId;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', language = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND surveyTitle LIKE ?`;
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
            `SELECT id, surveyTitle, language, status, questionIds, createdAt FROM questionnaire_groups ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM questionnaire_groups ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM questionnaire_groups WHERE id = ?`, [id]
        );
        if (!rows[0]) return null;

        const group = rows[0];
        // mysql2 auto-parses JSON columns, but guard in case it comes back as a string
        const questionIds = typeof group.questionIds === 'string' ? JSON.parse(group.questionIds) : (group.questionIds || []);

        let questions = [];
        if (questionIds.length > 0) {
            const placeholders = questionIds.map(() => '?').join(',');
            const [qRows] = await db.execute(
                `SELECT id, question_title, question_type, options, right_answer
                 FROM question_library
                 WHERE id IN (${placeholders})`,
                questionIds
            );
            questions = qRows;
        }

        return { ...group, questionIds, questions };
    },

    update: async (id, data) => {
        const fields = [];
        const values = [];

        if (data.surveyTitle !== undefined) { fields.push('surveyTitle = ?'); values.push(data.surveyTitle); }
        if (data.language !== undefined) { fields.push('language = ?'); values.push(data.language); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
        if (data.questionIds !== undefined) { fields.push('questionIds = ?'); values.push(JSON.stringify(data.questionIds)); }

        if (fields.length === 0) return null;

        values.push(id);
        const [result] = await db.execute(
            `UPDATE questionnaire_groups SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
            values
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE questionnaire_groups SET status = ?, updatedAt = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM questionnaire_groups WHERE id = ?`, [id]
        );
        return result;
    }
};

export default QuestionnaireGroup;