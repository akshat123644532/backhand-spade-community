import { db } from '../config/db.js';

const QuestionnaireGroup = {

    create: async (data) => {
        const { surveyTitle, language, status, questionIds } = data;

        const [result] = await db.execute(
            `INSERT INTO questionnaire_groups (group_title, language, status) VALUES (?, ?, ?)`,
            [surveyTitle, language, status || 'active']
        );
        const groupId = result.insertId;

        if (Array.isArray(questionIds) && questionIds.length > 0) {
            const values = questionIds.map(qId => [groupId, qId]);
            await db.query(
                `INSERT INTO questionnaire_group_questions (questionnaire_group_id, question_library_id) VALUES ?`,
                [values]
            );
        }

        return groupId;
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
            `SELECT id, group_title AS surveyTitle, language, status, created_at AS createdAt
             FROM questionnaire_groups ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM questionnaire_groups ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, group_title AS surveyTitle, language, status, created_at AS createdAt, updated_at AS updatedAt
             FROM questionnaire_groups WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        if (!rows[0]) return null;

        const group = rows[0];

        const [qLinkRows] = await db.execute(
            `SELECT question_library_id FROM questionnaire_group_questions WHERE questionnaire_group_id = ?`,
            [id]
        );
        const questionIds = qLinkRows.map(r => r.question_library_id);

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

        if (data.surveyTitle !== undefined) { fields.push('group_title = ?'); values.push(data.surveyTitle); }
        if (data.language !== undefined) { fields.push('language = ?'); values.push(data.language); }
        if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }

        if (fields.length > 0) {
            values.push(id);
            await db.execute(
                `UPDATE questionnaire_groups SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
                values
            );
        }

        if (data.questionIds !== undefined) {
            await db.execute(`DELETE FROM questionnaire_group_questions WHERE questionnaire_group_id = ?`, [id]);
            if (Array.isArray(data.questionIds) && data.questionIds.length > 0) {
                const values2 = data.questionIds.map(qId => [id, qId]);
                await db.query(
                    `INSERT INTO questionnaire_group_questions (questionnaire_group_id, question_library_id) VALUES ?`,
                    [values2]
                );
            }
        }

        return true;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE questionnaire_groups SET status = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE questionnaire_groups SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result;
    }
};

export default QuestionnaireGroup;