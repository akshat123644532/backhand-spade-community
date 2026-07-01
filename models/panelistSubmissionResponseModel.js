import { db } from '../config/db.js';

const PanelQuestionnaireResponse = {

    // saves one answer row per question
    saveResponses: async (panelist_id, answers) => {
        // answers = [{ question_id, answer }, ...]
        for (const ans of answers) {
            await db.execute(
                `INSERT INTO panel_questionnaire_responses (panelist_id, question_id, answer) VALUES (?, ?, ?)`,
                [panelist_id, ans.question_id, ans.answer]
            );
        }
    },

    hasResponded: async (panelist_id) => {
        const [rows] = await db.execute(
            `SELECT id FROM panel_questionnaire_responses WHERE panelist_id = ? LIMIT 1`,
            [panelist_id]
        );
        return rows.length > 0;
    },

    getByPanelist: async (panelist_id) => {
        const [rows] = await db.execute(
            `SELECT pqr.id, pqr.question_id, pq.question_title, pq.question_text, pqr.answer, pqr.created_at
             FROM panel_questionnaire_responses pqr
             JOIN panel_questionnaire pq ON pqr.question_id = pq.id
             WHERE pqr.panelist_id = ?
             ORDER BY pqr.created_at ASC`,
            [panelist_id]
        );
        return rows;
    }
};

export default PanelQuestionnaireResponse;