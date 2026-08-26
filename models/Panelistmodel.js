import { db } from '../config/db.js';

const Panelist = {

    findByEmail: async (email) => {
        const [rows] = await db.execute(`SELECT * FROM panelists WHERE email = ? AND deleted_at IS NULL`, [email]);
        return rows[0] || null;
    },

    findByEmailInsensitive: async (email) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists WHERE LOWER(email) = LOWER(?) AND deleted_at IS NULL LIMIT 1`,
            [String(email || '').trim()]
        );
        return rows[0] || null;
    },

    findById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM panelists WHERE id = ? AND deleted_at IS NULL`, [id]);
        return rows[0] || null;
    },

    create: async (data) => {
        const { name, email, phone, photo, password, activation_token, activation_token_expires, questionnaire_url } = data;
        const [result] = await db.execute(
            `INSERT INTO panelists
             (name, email, phone, photo, password, activation_token, activation_token_expires, questionnaire_url, balance_point)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [name, email, phone || null, photo || null, password, activation_token, activation_token_expires, questionnaire_url]
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

    markQuestionnaireCompleted: async (id, connection = db) => {
        await connection.execute(
            `UPDATE panelists SET questionnaire = 'yes', updated_at = NOW() WHERE id = ?`,
            [id]
        );
    },

    addBalancePoints: async (id, points, connection = db) => {
        await connection.execute(
            `UPDATE panelists SET balance_point = balance_point + ?, updated_at = NOW() WHERE id = ?`,
            [points, id]
        );
    },

    // Combines questionnaire completion + points credit + verify panelist in a single UPDATE
    completeQuestionnaireWithPoints: async (id, points, connection = db) => {
        await connection.execute(
            `UPDATE panelists
             SET questionnaire = 'yes', is_verified = 1, balance_point = balance_point + ?, updated_at = NOW()
             WHERE id = ?`,
            [points, id]
        );
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', is_verified = '', questionnaire = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        const cleanSearch = (search || '').trim();

        if (cleanSearch) {
            where += ` AND (LOWER(name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))`;
            params.push(`%${cleanSearch}%`, `%${cleanSearch}%`);
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

    findByIds: async (ids) => {
        if (!ids || ids.length === 0) return [];
        const placeholders = ids.map(() => '?').join(', ');
        const [rows] = await db.execute(
            `SELECT * FROM panelists WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
            ids
        );
        return rows;
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

    getAllPanelistsCount: async () => {
        const [result] = await db.query(
            `SELECT COUNT(*) as total FROM panelists WHERE deleted_at IS NULL`
        );
        return result[0].total || 0;
    },

    // Active, non-deleted panelist emails (optionally exclude already-used emails)
    getActiveEmails: async (limit, excludeEmails = []) => {
        if (!limit || limit < 1) return [];

        const excluded = [...new Set(
            (excludeEmails || [])
                .map((e) => String(e || '').trim().toLowerCase())
                .filter(Boolean)
        )];

        let sql = `
            SELECT email FROM panelists
            WHERE deleted_at IS NULL
              AND status = 'active'
              AND email IS NOT NULL
              AND email != ''
        `;
        const params = [];

        if (excluded.length) {
            const placeholders = excluded.map(() => '?').join(', ');
            sql += ` AND LOWER(email) NOT IN (${placeholders})`;
            params.push(...excluded);
        }

        sql += ` ORDER BY id ASC LIMIT ?`;
        params.push(Number(limit));

        const [rows] = await db.query(sql, params);
        return rows.map((r) => r.email).filter(Boolean);
    },

    countActive: async (excludeEmails = []) => {
        const excluded = [...new Set(
            (excludeEmails || [])
                .map((e) => String(e || '').trim().toLowerCase())
                .filter(Boolean)
        )];

        let sql = `
            SELECT COUNT(*) AS total FROM panelists
            WHERE deleted_at IS NULL
              AND status = 'active'
              AND email IS NOT NULL
              AND email != ''
        `;
        const params = [];

        if (excluded.length) {
            const placeholders = excluded.map(() => '?').join(', ');
            sql += ` AND LOWER(email) NOT IN (${placeholders})`;
            params.push(...excluded);
        }

        const [rows] = await db.query(sql, params);
        return Number(rows[0]?.total || 0);
    },
};

export default Panelist;