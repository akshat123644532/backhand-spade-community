import { db } from '../config/db.js';
import Panelist from './Panelistmodel.js';

const PanelQuestionnaireResponse = {

    saveResponses: async (panelist_id, answers, connection = db) => {
        if (!answers || answers.length === 0) return;

        const values = answers.map(ans => [panelist_id, ans.question_id, ans.answer]);
        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await connection.execute(
            `INSERT INTO panel_questionnaire_responses (panelist_id, question_id, answer) VALUES ${placeholders}`,
            flatValues
        );
    },

    // Saves answers + marks questionnaire complete + credits points in one transaction
    submitQuestionnaire: async (panelist_id, answers, points) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await PanelQuestionnaireResponse.saveResponses(panelist_id, answers, connection);
            await Panelist.completeQuestionnaireWithPoints(panelist_id, points, connection);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
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
