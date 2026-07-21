import { db } from '../config/db.js';

const PanelQuestionnaireResponse = {

    // comment saves all answers in a single bulk insert query
    saveResponses: async (panelist_id, answers) => {
        // answers = [{ question_id, answer }, ...]
        if (!answers || answers.length === 0) return;

        const values = answers.map(ans => [panelist_id, ans.question_id, ans.answer]);
        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await db.execute(
            `INSERT INTO panel_questionnaire_responses (panelist_id, question_id, answer) VALUES ${placeholders}`,
            flatValues
        );
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