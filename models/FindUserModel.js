import { db } from '../config/db.js';

const FindUser = {

    // Question Filter dropdown
    getFilterQuestions: async (language = 'english') => {
        const [rows] = await db.execute(
            `SELECT id, question_title, question_text, options
             FROM panel_questionnaire
             WHERE language = ? AND deleted_at IS NULL AND status = 'active'
             ORDER BY question_title ASC, sort_order ASC`,
            [language]
        );
        return rows;
    },

    // Answer Filter options (from the selected question's `options` JSON)
    getAnswerOptions: async (question_id) => {
        const [rows] = await db.execute(
            `SELECT id, question_title, question_text, options
             FROM panel_questionnaire WHERE id = ? AND deleted_at IS NULL`,
            [question_id]
        );
        return rows[0] || null;
    },

    // Core search — panelists matching ALL given {question_id, answer} filter pairs
    search: async (filters = [], { page = 1, limit = 10 } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;

        let joins = '';
        const where = `WHERE p.deleted_at IS NULL`;
        const params = [];

        filters.forEach((f, idx) => {
            const alias = `pqr${idx}`;
            joins += ` JOIN panel_questionnaire_responses ${alias} ON ${alias}.panelist_id = p.id AND ${alias}.question_id = ? AND ${alias}.answer LIKE ?`;
            params.push(f.question_id, `%${f.answer}%`);
        });

        const [rows] = await db.query(
            `SELECT p.id, p.name, p.email, p.phone, p.questionnaire AS pre_screen_completed,
                    p.balance_point, p.status, p.created_at AS joining_date
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