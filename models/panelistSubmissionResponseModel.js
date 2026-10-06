import { db } from '../config/db.js';
import Panelist from './Panelistmodel.js';

let uniqueIndexEnsured = false;

// One row per question. If the client sends the same question_id more than once, keep the last answer.
const dedupeAnswersByQuestion = (answers) => {
    const byQuestionId = new Map();
    for (const ans of answers) {
        byQuestionId.set(String(ans?.question_id), ans);
    }
    return [...byQuestionId.values()];
};

const alreadySubmittedError = () => {
    const error = new Error('Questionnaire already submitted!');
    error.code = 'QUESTIONNAIRE_ALREADY_SUBMITTED';
    return error;
};

// The table only had separate indexes, so nothing stopped two rows for the same panelist + question.
const ensureUniquePanelistQuestion = async () => {
    if (uniqueIndexEnsured) return;

    try {
        await db.execute(
            `ALTER TABLE panel_questionnaire_responses
             ADD UNIQUE KEY uniq_panelist_question (panelist_id, question_id)`
        );
    } catch (error) {
        if (error.code !== 'ER_DUP_KEYNAME' && error.errno !== 1061) {
            console.error('panel_questionnaire_responses unique index:', error.message);
        }
    }

    uniqueIndexEnsured = true;
};

const PanelQuestionnaireResponse = {

    saveResponses: async (panelist_id, answers, connection = db) => {
        const uniqueAnswers = dedupeAnswersByQuestion(answers);
        if (uniqueAnswers.length === 0) return;

        const values = uniqueAnswers.map(ans => [panelist_id, ans.question_id, ans.answer]);
        const placeholders = values.map(() => '(?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await connection.execute(
            `INSERT INTO panel_questionnaire_responses (panelist_id, question_id, answer) VALUES ${placeholders}`,
            flatValues
        );
    },

    // Saves answers and marks the questionnaire complete in one transaction.
    // The panelist row is locked first so two overlapping submits cannot both insert.
    submitQuestionnaire: async (panelist_id, answers) => {
        await ensureUniquePanelistQuestion();

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [panelistRows] = await connection.execute(
                `SELECT id, questionnaire
                 FROM panelists
                 WHERE id = ?
                 FOR UPDATE`,
                [panelist_id]
            );

            if (panelistRows[0]?.questionnaire === 'yes') {
                throw alreadySubmittedError();
            }

            await PanelQuestionnaireResponse.saveResponses(panelist_id, answers, connection);
            await Panelist.completeQuestionnaireWithPoints(panelist_id, connection);
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
