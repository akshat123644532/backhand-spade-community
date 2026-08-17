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

    // 👇 NAYA: Multi Link projects ke liye — is project ke saare ACTIVE status wale VenderURLs nikalo
    getActiveVenderUrlsByProjectId: async (project_id, conn = db) => {
        const [rows] = await conn.execute(
            `SELECT id, VenderURL FROM project_mutiple_Url 
             WHERE project_id = ? AND Status = 'active' AND VenderURL IS NOT NULL AND VenderURL != ''
             ORDER BY id ASC`,
            [project_id]
        );
        return rows;
    },

    getStatsByProjectId: async (project_id, project_url_id = null, conn = db) => {
        // Back-compat: older callers used (project_id, conn)
        if (project_url_id && typeof project_url_id === 'object' && typeof project_url_id.execute === 'function') {
            conn = project_url_id;
            project_url_id = null;
        }

        let sql = `SELECT
                COUNT(*) AS totalMultiLinkCount,
                SUM(CASE WHEN partner_id IS NOT NULL THEN 1 ELSE 0 END) AS assignedCount,
                SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) AS completedSurveyCount
             FROM project_mutiple_Url
             WHERE project_id = ?`;
        const params = [project_id];

        if (project_url_id != null && project_url_id !== '') {
            sql += ` AND project_url_id = ?`;
            params.push(project_url_id);
        }

        const [rows] = await conn.execute(sql, params);
        const total = Number(rows[0]?.totalMultiLinkCount || 0);
        const assigned = Number(rows[0]?.assignedCount || 0);
        const completedSurvey = Number(rows[0]?.completedSurveyCount || 0);
        return {
            totalMultiLinkCount: total,
            remainingMultiLinkCount: Math.max(total - assigned, 0),
            completedSurveyCount: completedSurvey
        };
    },

    getUnassignedIds: async (project_id, limit, conn = db, project_url_id = null) => {
        let sql = `SELECT id FROM project_mutiple_Url
             WHERE project_id = ?
               AND partner_id IS NULL`;
        const params = [project_id];

        if (project_url_id != null && project_url_id !== '') {
            sql += ` AND project_url_id = ?`;
            params.push(project_url_id);
        }

        sql += ` ORDER BY id ASC LIMIT ?`;
        params.push(Number(limit));

        const [rows] = await conn.query(sql, params);
        return rows.map((r) => r.id);
    },

    assignPartnerToRows: async ({ ids, partner_id }, conn = db) => {
        if (!ids?.length) return 0;
        const placeholders = ids.map(() => '?').join(',');
        const [result] = await conn.execute(
            `UPDATE project_mutiple_Url
             SET partner_id = ?, UserType = 'PARTNER'
             WHERE id IN (${placeholders})`,
            [partner_id, ...ids]
        );
        return result.affectedRows;
    },

    getAssignedIdsByPartner: async (project_id, partner_id, conn = db, project_url_id = null) => {
        let sql = `SELECT id FROM project_mutiple_Url
             WHERE project_id = ? AND partner_id = ?`;
        const params = [project_id, partner_id];

        if (project_url_id != null && project_url_id !== '') {
            sql += ` AND project_url_id = ?`;
            params.push(project_url_id);
        }

        sql += ` ORDER BY id ASC`;
        const [rows] = await conn.execute(sql, params);
        return rows.map((r) => r.id);
    },

    unassignPartnerFromRows: async (ids, conn = db) => {
        if (!ids?.length) return 0;
        const placeholders = ids.map(() => '?').join(',');
        // Keep Vender_UserName (uid from CSV); only clear partner assignment
        const [result] = await conn.execute(
            `UPDATE project_mutiple_Url
             SET partner_id = NULL, UserType = 'VENDOR'
             WHERE id IN (${placeholders})`,
            ids
        );
        return result.affectedRows;
    },

    getById: async (id, conn = db) => {
        const [rows] = await conn.execute(
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
    getSurveyByAccess: async ({ project_id, project_url_id, Vender_UserName, partner_id = null }) => {
        const params = [project_id, project_url_id, String(Vender_UserName || '').trim()];
        let partnerSql = '';
        if (partner_id != null && partner_id !== '') {
            partnerSql = ' AND partner_id = ?';
            params.push(partner_id);
        }

        const [rows] = await db.execute(
            `SELECT id, partner_id, project_id, project_url_id, Live_Link, VenderURL,
                    Vender_UserName, UserType, Status
             FROM project_mutiple_Url
             WHERE project_id = ?
               AND project_url_id = ?
               AND LOWER(Vender_UserName) = LOWER(?)
               ${partnerSql}
             ORDER BY id DESC
             LIMIT 1`,
            params
        );
        return rows[0] || null;
    },

    updateStatusByAccess: async ({ project_id, project_url_id, partner_id, Vender_UserName, Status }) => {
        const params = [
            Status,
            project_id,
            project_url_id,
            String(Vender_UserName || '').trim()
        ];
        let partnerSql = '';
        if (partner_id != null && partner_id !== '') {
            partnerSql = ' AND partner_id = ?';
            params.push(partner_id);
        }

        const [result] = await db.execute(
            `UPDATE project_mutiple_Url
             SET Status = ?
             WHERE project_id = ?
               AND project_url_id = ?
               AND LOWER(Vender_UserName) = LOWER(?)
               AND LOWER(Status) IN ('initiated', 'active')
               ${partnerSql}`,
            params
        );
        return result.affectedRows;
    },

    /**
     * Get a mapped partner_id for this project + project_url_id (multi-link).
     */
    getMappedPartnerId: async (project_id, project_url_id) => {
        const [rows] = await db.execute(
            `SELECT partner_id
             FROM project_mutiple_Url
             WHERE project_id = ?
               AND project_url_id = ?
               AND partner_id IS NOT NULL
             ORDER BY id ASC
             LIMIT 1`,
            [project_id, project_url_id]
        );
        const partnerId = rows[0]?.partner_id;
        return partnerId == null || partnerId === '' ? null : Number(partnerId);
    },

    /** First active multi-link row for partner + project + project_url */
    getFirstActiveByPartnerProjectUrl: async ({ project_id, project_url_id, partner_id }) => {
        const [rows] = await db.execute(
            `SELECT id, partner_id, project_id, project_url_id, Live_Link, VenderURL,
                    Vender_UserName, UserType, Status
             FROM project_mutiple_Url
             WHERE project_id = ?
               AND project_url_id = ?
               AND partner_id = ?
               AND LOWER(Status) = 'active'
             ORDER BY id ASC
             LIMIT 1`,
            [project_id, project_url_id, partner_id]
        );
        return rows[0] || null;
    },

    /**
     * On survey start: bind uid → Vender_UserName for the first unbound row
     * (NULL or legacy XXXXXX placeholder) for this project_id + project_url_id
     * (+ partner when provided). If already set to this uid, leave it unchanged.
     */
    bindUidOnSurveyStart: async ({ project_id, project_url_id, partner_id, uid }) => {
        const userName = String(uid || '').trim();
        if (!userName) return null;

        const PLACEHOLDER = 'XXXXXX';
        const params = [project_id, project_url_id];
        let partnerSql = '';
        if (partner_id != null && partner_id !== '') {
            partnerSql = ' AND partner_id = ?';
            params.push(partner_id);
        }

        // Already bound to this uid — no change
        const [existingRows] = await db.execute(
            `SELECT id, partner_id, project_id, project_url_id, Live_Link, VenderURL,
                    Vender_UserName, UserType, Status
             FROM project_mutiple_Url
             WHERE project_id = ?
               AND project_url_id = ?
               ${partnerSql}
               AND LOWER(Vender_UserName) = LOWER(?)
             ORDER BY id ASC
             LIMIT 1`,
            [...params, userName]
        );
        if (existingRows[0]) return existingRows[0];

        // Claim first unbound row (NULL or legacy XXXXXX)
        const [unboundRows] = await db.execute(
            `SELECT id, partner_id, project_id, project_url_id, Live_Link, VenderURL,
                    Vender_UserName, UserType, Status
             FROM project_mutiple_Url
             WHERE project_id = ?
               AND project_url_id = ?
               ${partnerSql}
               AND (
                    Vender_UserName IS NULL
                    OR TRIM(Vender_UserName) = ''
                    OR UPPER(TRIM(Vender_UserName)) = ?
               )
             ORDER BY id ASC
             LIMIT 1`,
            [...params, PLACEHOLDER]
        );

        if (!unboundRows[0]) return null;

        await db.execute(
            `UPDATE project_mutiple_Url SET Vender_UserName = ? WHERE id = ?`,
            [userName, unboundRows[0].id]
        );

        return {
            ...unboundRows[0],
            Vender_UserName: userName
        };
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