import { db } from '../config/db.js';

const SurveyPage = {
    getById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM survey_pages WHERE id = ?`, [id]);
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE survey_pages SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    }
};

export default SurveyPage;