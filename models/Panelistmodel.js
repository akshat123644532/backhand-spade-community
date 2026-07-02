import { db } from '../config/db.js';

const Panelist = {

    findByEmail: async (email) => {
        const [rows] = await db.execute(`SELECT * FROM panelists WHERE email = ? AND deleted_at IS NULL`, [email]);
        return rows[0] || null;
    },

    findById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM panelists WHERE id = ? AND deleted_at IS NULL`, [id]);
        return rows[0] || null;
    },

    create: async (data) => {
        const { name, email, password, activation_token, activation_token_expires, questionnaire_url } = data;
        const [result] = await db.execute(
            `INSERT INTO panelists (name, email, password, activation_token, activation_token_expires, questionnaire_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, email, password, activation_token, activation_token_expires, questionnaire_url]
        );
        return result.insertId;
    },

    findByToken: async (token) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists WHERE activation_token = ? AND deleted_at IS NULL`,
            [token]
        );
        return rows[0] || null;
    },

    activatePanelist: async (id) => {
        await db.execute(
            `UPDATE panelists SET is_verified = 1, activation_token = NULL, activation_token_expires = NULL WHERE id = ?`,
            [id]
        );
    },

    // ===== Questionnaire flow =====

    findByQuestionnaireUrl: async (questionnaire_url) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists WHERE questionnaire_url = ? AND deleted_at IS NULL`,
            [questionnaire_url]
        );
        return rows[0] || null;
    },

    setQuestionnaireUrl: async (id, questionnaire_url) => {
        await db.execute(
            `UPDATE panelists SET questionnaire_url = ? WHERE id = ?`,
            [questionnaire_url, id]
        );
    },

    markQuestionnaireCompleted: async (id) => {
        await db.execute(
            `UPDATE panelists SET questionnaire = 'yes', updated_at = NOW() WHERE id = ?`,
            [id]
        );
    },

    addBalancePoints: async (id, points) => {
        await db.execute(
            `UPDATE panelists SET balance_point = balance_point + ?, updated_at = NOW() WHERE id = ?`,
            [points, id]
        );
    }
};

export default Panelist;
