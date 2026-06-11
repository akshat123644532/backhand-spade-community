import { db } from '../config/db.js';

const PrescreenSurvey = {

    create: async (data) => {
        const { survey_title, language, status } = data;
        const [result] = await db.execute(
            `INSERT INTO prescreen_surveys (survey_title, language, status) VALUES (?, ?, ?)`,
            [survey_title, language, status || 'active']
        );
        return result.insertId;
    },

    addQuestions: async (prescreen_survey_id, prescreen_ids) => {
        for (const prescreen_id of prescreen_ids) {
            await db.execute(
                `INSERT INTO prescreen_survey_questions (prescreen_survey_id, prescreen_id) VALUES (?, ?)`,
                [prescreen_survey_id, prescreen_id]
            );
        }
    },

    deleteQuestions: async (prescreen_survey_id) => {
        await db.execute(
            `DELETE FROM prescreen_survey_questions WHERE prescreen_survey_id = ?`,
            [prescreen_survey_id]
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
            `SELECT id, survey_title, language, status, created_at FROM prescreen_surveys ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM prescreen_surveys ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM prescreen_surveys WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        if (!rows[0]) return null;

        const [questions] = await db.execute(
            `SELECT p.id, p.question_title, p.right_answer,
             JSON_ARRAYAGG(po.option_text) as options
             FROM prescreen_survey_questions psq
             JOIN prescreens p ON psq.prescreen_id = p.id
             LEFT JOIN prescreen_options po ON p.id = po.prescreen_id
             WHERE psq.prescreen_survey_id = ?
             GROUP BY p.id`,
            [id]
        );

        return { ...rows[0], questions };
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE prescreen_surveys SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE prescreen_surveys SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE prescreen_surveys SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default PrescreenSurvey;