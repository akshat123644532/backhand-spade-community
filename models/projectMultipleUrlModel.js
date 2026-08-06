import { db } from '../config/db.js';

const ProjectMultipleUrl = {

    create: async (data, conn = db) => {
        const { project_id, project_url_id, partner_id, Live_Link, VenderURL, Vender_UserName, UserType, Status } = data;
        const [result] = await conn.execute(
            `INSERT INTO project_mutiple_Url (project_id, project_url_id, partner_id, Live_Link, VenderURL, Vender_UserName, UserType, Status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                project_id,
                project_url_id || null,
                partner_id || null,
                Live_Link || null,
                VenderURL || null,
                Vender_UserName || null,
                UserType || null,
                Status || 'active'
            ]
        );
        return result.insertId;
    },

    bulkCreate: async (rows, conn = db) => {
        if (!rows?.length) return 0;

        const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = [];
        for (const row of rows) {
            values.push(
                row.project_id,
                row.project_url_id || null,
                row.partner_id || null,
                row.Live_Link || null,
                row.VenderURL || null,
                row.Vender_UserName || null,
                row.UserType || null,
                row.Status || 'active'
            );
        }

        const [result] = await conn.execute(
            `INSERT INTO project_mutiple_Url
             (project_id, project_url_id, partner_id, Live_Link, VenderURL, Vender_UserName, UserType, Status)
             VALUES ${placeholders}`,
            values
        );
        return result.affectedRows;
    },

    // Insert N placeholder rows, return consecutive ids starting at insertId
    bulkCreatePlaceholders: async ({ project_id, project_url_id, partner_id, count }, conn = db) => {
        if (!count || count < 1) return [];

        const placeholders = Array(count).fill('(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = [];
        const userType = partner_id ? 'PARTNER' : 'VENDOR';
        for (let i = 0; i < count; i++) {
            values.push(
                project_id,
                project_url_id || null,
                partner_id || null,
                null,
                null,
                null,
                userType,
                'active'
            );
        }

        const [result] = await conn.execute(
            `INSERT INTO project_mutiple_Url
             (project_id, project_url_id, partner_id, Live_Link, VenderURL, Vender_UserName, UserType, Status)
             VALUES ${placeholders}`,
            values
        );

        const ids = [];
        for (let i = 0; i < count; i++) ids.push(result.insertId + i);
        return ids;
    },

    updateVenderUrls: async (updates, conn = db) => {
        for (const { id, VenderURL } of updates) {
            await conn.execute(
                `UPDATE project_mutiple_Url SET VenderURL = ? WHERE id = ?`,
                [VenderURL, id]
            );
        }
    },

    getByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_mutiple_Url WHERE project_id = ?`, [project_id]
        );
        return rows;
    },

    getStatsByProjectId: async (project_id, conn = db) => {
        const [rows] = await conn.execute(
            `SELECT
                COUNT(*) AS totalMultiLinkCount,
                SUM(CASE WHEN partner_id IS NOT NULL AND Vender_UserName IS NOT NULL AND Vender_UserName != '' THEN 1 ELSE 0 END) AS assignedCount,
                SUM(CASE WHEN partner_id IS NOT NULL AND Vender_UserName IS NOT NULL AND Vender_UserName != '' AND Status = 'completed' THEN 1 ELSE 0 END) AS completedSurveyCount
             FROM project_mutiple_Url
             WHERE project_id = ?`,
            [project_id]
        );
        const total = Number(rows[0]?.totalMultiLinkCount || 0);
        const assigned = Number(rows[0]?.assignedCount || 0);
        const completedSurvey = Number(rows[0]?.completedSurveyCount || 0);
        return {
            totalMultiLinkCount: total,
            remainingMultiLinkCount: Math.max(total - assigned, 0),
            completedSurveyCount: completedSurvey
        };
    },

    getUnassignedIds: async (project_id, limit, conn = db) => {
        const [rows] = await conn.query(
            `SELECT id FROM project_mutiple_Url
             WHERE project_id = ?
               AND (partner_id IS NULL OR Vender_UserName IS NULL OR Vender_UserName = '')
             ORDER BY id ASC
             LIMIT ?`,
            [project_id, Number(limit)]
        );
        return rows.map((r) => r.id);
    },

    assignPartnerToRows: async ({ ids, partner_id, Vender_UserName }, conn = db) => {
        if (!ids?.length) return 0;
        const placeholders = ids.map(() => '?').join(',');
        const [result] = await conn.execute(
            `UPDATE project_mutiple_Url
             SET partner_id = ?, Vender_UserName = ?, UserType = 'PARTNER'
             WHERE id IN (${placeholders})`,
            [partner_id, Vender_UserName, ...ids]
        );
        return result.affectedRows;
    },

    getAssignedIdsByPartner: async (project_id, partner_id, conn = db) => {
        const [rows] = await conn.execute(
            `SELECT id FROM project_mutiple_Url
             WHERE project_id = ? AND partner_id = ?
             ORDER BY id ASC`,
            [project_id, partner_id]
        );
        return rows.map((r) => r.id);
    },

    unassignPartnerFromRows: async (ids, conn = db) => {
        if (!ids?.length) return 0;
        const placeholders = ids.map(() => '?').join(',');
        const [result] = await conn.execute(
            `UPDATE project_mutiple_Url
             SET partner_id = NULL, Vender_UserName = NULL, UserType = 'VENDOR'
             WHERE id IN (${placeholders})`,
            ids
        );
        return result.affectedRows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_mutiple_Url WHERE id = ?`, [id]
        );
        return rows[0] || null;
    },

    existsByVenderUserName: async (email) => {
        const [rows] = await db.execute(
            `SELECT id FROM project_mutiple_Url
             WHERE LOWER(Vender_UserName) = LOWER(?)
             LIMIT 1`,
            [String(email || '').trim()]
        );
        return Boolean(rows[0]);
    },

    getByVenderUserName: async (email) => {
        const [rows] = await db.execute(
            `SELECT id, partner_id, project_id, project_url_id, Live_Link, VenderURL,
                    Vender_UserName, UserType, Status
             FROM project_mutiple_Url
             WHERE LOWER(Vender_UserName) = LOWER(?)
               AND VenderURL IS NOT NULL
               AND VenderURL != ''
             ORDER BY id DESC`,
            [String(email || '').trim()]
        );
        return rows;
    },

    /** Resolve multi-link survey row by project + url + vendor email (uid) */
    getSurveyByAccess: async ({ project_id, project_url_id, Vender_UserName }) => {
        const [rows] = await db.execute(
            `SELECT id, partner_id, project_id, project_url_id, Live_Link, VenderURL,
                    Vender_UserName, UserType, Status
             FROM project_mutiple_Url
             WHERE project_id = ?
               AND project_url_id = ?
               AND LOWER(Vender_UserName) = LOWER(?)
             ORDER BY id DESC
             LIMIT 1`,
            [project_id, project_url_id, String(Vender_UserName || '').trim()]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE project_mutiple_Url SET ${fields} WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM project_mutiple_Url WHERE id = ?`, [id]
        );
        return result;
    }
};

export default ProjectMultipleUrl;
