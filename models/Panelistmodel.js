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
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', is_verified = '', questionnaire = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND (name LIKE ? OR email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }
        if (is_verified !== '') {
            where += ` AND is_verified = ?`;
            params.push(is_verified);
        }
        if (questionnaire) {
            where += ` AND questionnaire = ?`;
            params.push(questionnaire);
        }

        const [rows] = await db.query(
            `SELECT id, name, email, status, is_verified, questionnaire, balance_point, created_at
             FROM panelists ${where}
             ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM panelists ${where}`, params
        );

        return {
            data: rows,
            total: countResult[0].total || 0,
            page: p,
            limit: l,
            totalPages: Math.ceil((countResult[0].total || 0) / l)
        };
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE panelists SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE panelists SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE panelists SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },
};

export default Panelist;