import { db } from '../config/db.js';

const FindUser = {

    // Question Filter dropdown — Panel Questionnaire ke saare active questions
    getFilterQuestions: async () => {
        const [rows] = await db.execute(
            `SELECT id, question_title, question_type, options
             FROM panel_questionnaire
             WHERE deleted_at IS NULL AND status = 'active'
             ORDER BY sort_order ASC`
        );
        return rows;
    },

    // Answer Filter — distinct answers actually submitted by panelists for this question
    getAnswerOptions: async (question_id) => {
        const [questionRows] = await db.execute(
            `SELECT id, question_title, question_type
             FROM panel_questionnaire
             WHERE id = ? AND deleted_at IS NULL`,
            [question_id]
        );
        if (!questionRows[0]) return null;

        const [answerRows] = await db.execute(
            `SELECT DISTINCT answer
             FROM panel_questionnaire_responses
             WHERE question_id = ? AND answer IS NOT NULL AND answer != ''
             ORDER BY answer ASC`,
            [question_id]
        );

        return {
            id: questionRows[0].id,
            question_title: questionRows[0].question_title,
            question_type: questionRows[0].question_type,
            answers: answerRows.map(r => r.answer)
        };
    },

    // Question titles map — used to label matched_answers in searchUsers response
    getQuestionTitles: async (questionIds = []) => {
        if (!questionIds || questionIds.length === 0) return {};

        const placeholders = questionIds.map(() => '?').join(',');
        const [rows] = await db.execute(
            `SELECT id, question_title
             FROM panel_questionnaire
             WHERE id IN (${placeholders})`,
            questionIds
        );

        const map = {};
        rows.forEach(r => { map[r.id] = r.question_title; });
        return map;
    },

    // Core search — panelists matching ALL given question filters (AND across filters),
    // where each filter can have multiple selected answers (OR within that question)
    // filters = [{ question_id, answers: ['40', '35', '50', '30'] }, ...]
    search: async (filters = [], { page = 1, limit = 10 } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;

        let joins = '';
        let answerSelects = '';
        const where = `WHERE p.deleted_at IS NULL`;
        const params = [];

        filters.forEach((f, idx) => {
            const alias = `pqr${idx}`;
            const answers = Array.isArray(f.answers) ? f.answers : [f.answer];
            const placeholders = answers.map(() => '?').join(',');

            joins += ` JOIN panel_questionnaire_responses ${alias} ON ${alias}.panelist_id = p.id AND ${alias}.question_id = ? AND ${alias}.answer IN (${placeholders})`;
            answerSelects += `, ${alias}.answer AS answer_${idx}`;
            params.push(f.question_id, ...answers);
        });

        const [rows] = await db.query(
            `SELECT p.id, p.name, p.email, p.phone, p.questionnaire AS pre_screen_completed,
                    p.balance_point, p.status, p.created_at AS joining_date
                    ${answerSelects}
             FROM panelists p
             ${joins}
             ${where}
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(DISTINCT p.id) as total FROM panelists p ${joins} ${where}`,
            params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    }
};

export default FindUser;