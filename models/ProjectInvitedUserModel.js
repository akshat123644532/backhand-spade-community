import { db } from '../config/db.js';

const ProjectInvitedUser = {

    create: async (data) => {
        const { project_id, panelist_id, email_template_id, message } = data;
        const [result] = await db.execute(
            `INSERT INTO project_invited_users (project_id, panelist_id, email_template_id, invite_status, message, invited_at)
             VALUES (?, ?, ?, 'invited', ?, NOW())
             ON DUPLICATE KEY UPDATE
               email_template_id = VALUES(email_template_id),
               invite_status = 'invited',
               message = VALUES(message),
               invited_at = NOW(),
               updated_at = NOW()`,
            [project_id, panelist_id, email_template_id || null, message || null]
        );
        return result.insertId || null;
    },

    getMapByProject: async (project_id, panelistIds) => {
        if (!panelistIds || !panelistIds.length) return {};
        const placeholders = panelistIds.map(() => '?').join(',');
        const [rows] = await db.execute(
            `SELECT * FROM project_invited_users WHERE project_id = ? AND panelist_id IN (${placeholders})`,
            [project_id, ...panelistIds]
        );
        const map = {};
        rows.forEach(r => { map[r.panelist_id] = r; });
        return map;
    },

    getByProject: async (project_id, { page = 1, limit = 10 } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;

        const [rows] = await db.query(
            `SELECT piu.id, piu.invite_status, piu.message, piu.status, piu.invited_at,
                    p.id AS panelist_id, p.name, p.email, p.phone, p.balance_point,
                    p.questionnaire AS pre_screen_completed, p.created_at AS joining_date
             FROM project_invited_users piu
             JOIN panelists p ON p.id = piu.panelist_id
             WHERE piu.project_id = ?
             ORDER BY piu.invited_at DESC
             LIMIT ? OFFSET ?`,
            [project_id, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM project_invited_users WHERE project_id = ?`, [project_id]
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    }
};

export default ProjectInvitedUser;