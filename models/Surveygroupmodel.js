import { db } from '../config/db.js';

const SurveyGroup = {

    create: async (data) => {
        const { survey_title, language, status } = data;
        const [result] = await db.execute(
            `INSERT INTO survey_groups (survey_title, language, status) VALUES (?, ?, ?)`,
            [survey_title, language, status || 'active']
        );
        return result.insertId;
    },

    addQuestions: async (survey_group_id, questions) => {
        for (const question of questions) {
            await db.execute(
                `INSERT INTO survey_group_questions (survey_group_id, question) VALUES (?, ?)`,
                [survey_group_id, question]
            );
        }
    },

    deleteQuestions: async (survey_group_id) => {
        await db.execute(
            `DELETE FROM survey_group_questions WHERE survey_group_id = ?`,
            [survey_group_id]
        );
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', language = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND survey_title LIKE ?`;
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
            `SELECT id, survey_title, language, status, created_at FROM survey_groups ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM survey_groups ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM survey_groups WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        if (!rows[0]) return null;

        const [questions] = await db.execute(
            `SELECT id, question FROM survey_group_questions WHERE survey_group_id = ?`, [id]
        );

        return { ...rows[0], questions };
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE survey_groups SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE survey_groups SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE survey_groups SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default SurveyGroup;