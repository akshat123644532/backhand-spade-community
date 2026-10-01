import { db } from '../config/db.js';

const PanelistPortal = {
    getByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, password, is_verified, status, questionnaire
             FROM panelists WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        return rows[0] || null;
    },

    getDashboard: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, phone, photo, balance_point, status, questionnaire, created_at
             FROM panelists WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    getPasswordById: async (id) => {
        const [rows] = await db.execute(
            `SELECT password FROM panelists WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0]?.password || null;
    },

    getRewardHistory: async (id, { page = 1, limit = 10 } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        const [rows] = await db.query(
            `SELECT id, reward_points, transaction_type, reward_type, status, remarks, created_at
             FROM reward_history
             WHERE user_id = ?
             ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [id, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reward_history WHERE user_id = ?`, [id]
        );
        const [summary] = await db.query(
            `SELECT
                SUM(CASE WHEN transaction_type = 'credit' THEN reward_points ELSE 0 END) AS total_credit,
                SUM(CASE WHEN transaction_type = 'debit' THEN reward_points ELSE 0 END) AS total_debit
             FROM reward_history WHERE user_id = ?`, [id]
        );
        return {
            data: rows,
            total: countResult[0].total || 0,
            page: p,
            limit: l,
            totalPages: Math.ceil((countResult[0].total || 0) / l),
            summary: {
                total_credit: summary[0].total_credit || 0,
                total_debit: summary[0].total_debit || 0,
                total_balance: (summary[0].total_credit || 0) - (summary[0].total_debit || 0)
            }
        };
    },

    getRedeemRequests: async (id, { page = 1, limit = 10 } = {}) => {
    const p = parseInt(page) || 1;
    const l = parseInt(limit) || 10;
    const offset = (p - 1) * l;
    const [rows] = await db.query(
        `SELECT id, reward_points, status, remark, comment,
                admin_remark, admin_comment,
                action_by, action_date, created_at
         FROM reward_redeem_requests
         WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [id, Number(l), Number(offset)]
    );
   
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM reward_redeem_requests WHERE user_id = ?`, [id]
        );
        return {
            data: rows,
            total: countResult[0].total || 0,
            page: p,
            limit: l,
            totalPages: Math.ceil((countResult[0].total || 0) / l)
        };
    },

    updateProfile: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        await db.execute(
            `UPDATE panelists SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
    },

    changePassword: async (id, hashedPassword) => {
        await db.execute(
            `UPDATE panelists SET password = ?, updated_at = NOW() WHERE id = ?`,
            [hashedPassword, id]
        );
    },

    submitRedeemRequest: async (data) => {
        const { user_id, reward_points, requested_by, remark, comment } = data;
        const [result] = await db.execute(
            `INSERT INTO reward_redeem_requests (user_id, reward_points, requested_by, remark, comment)
             VALUES (?, ?, ?, ?, ?)`,
            [user_id, reward_points, requested_by, remark || null, comment || null]
        );
        return result.insertId;
    },

    // ── Forgot / Reset password ──────────────────────────────
    setResetToken: async (email, token, expires) => {
        await db.execute(
            `UPDATE panelists SET reset_token = ?, reset_token_expires = ? WHERE email = ? AND deleted_at IS NULL`,
            [token, expires, email]
        );
    },

    getByResetToken: async (token) => {
        const [rows] = await db.execute(
            `SELECT id, name, email, reset_token_expires
             FROM panelists WHERE reset_token = ? AND deleted_at IS NULL`,
            [token]
        );
        return rows[0] || null;
    },

    resetPassword: async (id, hashedPassword) => {
        await db.execute(
            `UPDATE panelists
             SET password = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
             WHERE id = ?`,
            [hashedPassword, id]
        );
    },

    /**
     * Surveys assigned to a panelist through email campaigns, with the latest
     * attempt on survery_data and survey_prescreen_response.
     * The campaign link uid decrypts to the panelist id, which is stored as UserId.
     */
    getAssignedSurveys: async (panelistId) => {
        const userId = String(panelistId);
        const [rows] = await db.execute(
            `SELECT
                ecr.id AS recipient_id,
                ecr.campaign_id,
                ecr.email,
                ecr.specific_survey_link,
                ecr.status AS invite_status,
                ecr.sent_at,
                pui.id AS project_url_id,
                pui.project_id,
                pui.project_url_code,
                pui.description AS survey_title,
                pui.CompletionPoint AS completion_points,
                pui.\`LOI(Minute)\` AS loi,
                pi.Project_Name AS project_name,
                sd.id AS survey_data_id,
                sd.Status AS survey_status,
                sd.StartDate AS started_at,
                sd.EndDate AS ended_at,
                spr.id AS prescreen_id,
                spr.status AS prescreen_status
             FROM email_campaign_recipients ecr
             INNER JOIN (
                SELECT MAX(id) AS id
                FROM email_campaign_recipients
                WHERE user_id = ?
                  AND specific_survey_link IS NOT NULL
                  AND specific_survey_link LIKE '%pid=%'
                GROUP BY SUBSTRING_INDEX(SUBSTRING_INDEX(specific_survey_link, 'pid=', -1), '&', 1)
             ) latest ON latest.id = ecr.id
             INNER JOIN project_url_Info pui
                ON pui.project_url_code = SUBSTRING_INDEX(SUBSTRING_INDEX(ecr.specific_survey_link, 'pid=', -1), '&', 1)
               AND (pui.deleted_at IS NULL)
             LEFT JOIN project_Info pi
                ON pi.id = pui.project_id
             LEFT JOIN survery_data sd
                ON sd.id = (
                    SELECT s2.id
                    FROM survery_data s2
                    WHERE s2.projectid = pui.project_id
                      AND s2.project_url_id = pui.id
                      AND LOWER(s2.UserId) = LOWER(?)
                    ORDER BY s2.id DESC
                    LIMIT 1
                )
             LEFT JOIN survey_prescreen_response spr
                ON spr.id = (
                    SELECT p2.id
                    FROM survey_prescreen_response p2
                    WHERE p2.survey_data_id = sd.id
                    ORDER BY p2.id DESC
                    LIMIT 1
                )
             WHERE ecr.user_id = ?
             ORDER BY COALESCE(sd.StartDate, ecr.sent_at) DESC, ecr.id DESC`,
            [panelistId, userId, panelistId]
        );
        return rows;
    }
};

export default PanelistPortal;

