import { db } from '../config/db.js';
import { getLocationFromIp } from '../utils/linkSecurityHelper.js';
const TABLE = 'survery_data';
const STATUS_INITIATED = 'Initiated';

let indexReady = false;

const SurveyData = {
    STATUS_INITIATED,

    /** Composite index for duplicate / access checks */
    ensureIndex: async () => {
        if (indexReady) return;
        try {
            await db.query(
                `CREATE INDEX idx_survey_activity_access
                 ON \`${TABLE}\` (partnerid, projectid, project_url_id, UserId, InitalIP, Status)`
            );
        } catch (err) {
            // 1061 = duplicate key name, 1060/etc. — index already exists
            if (err?.errno !== 1061 && err?.code !== 'ER_DUP_KEYNAME') {
                throw err;
            }
        }
        indexReady = true;
    },

    /**
     * Find a completed/in-progress (non-Initiated) row for the same access combo.
     * Used to block re-entry after survey has moved past Initiated.
     */
    findBlockedAccess: async ({ partnerid, projectid, project_url_id, UserId, InitalIP }) => {
        const [rows] = await db.execute(
            `SELECT id, Status, StartDate, EndDate
             FROM \`${TABLE}\`
             WHERE partnerid <=> ?
               AND projectid = ?
               AND project_url_id = ?
               AND UserId = ?
               AND InitalIP = ?
               AND Status IS NOT NULL
               AND Status <> ?
             ORDER BY id DESC
             LIMIT 1`,
            [partnerid, projectid, project_url_id, UserId, InitalIP, STATUS_INITIATED]
        );
        return rows[0] || null;
    },

    findInitiated: async ({ partnerid, projectid, project_url_id, UserId, InitalIP }) => {
        const [rows] = await db.execute(
            `SELECT *
             FROM \`${TABLE}\`
             WHERE partnerid <=> ?
               AND projectid = ?
               AND project_url_id = ?
               AND UserId = ?
               AND InitalIP = ?
               AND Status = ?
             ORDER BY id DESC
             LIMIT 1`,
            [partnerid, projectid, project_url_id, UserId, InitalIP, STATUS_INITIATED]
        );
        return rows[0] || null;
    },

    /** Any row for this partner/project/url + UserId (any IP). */
    findByUserId: async ({ partnerid, projectid, project_url_id, UserId }) => {
        const [rows] = await db.execute(
            `SELECT *
             FROM \`${TABLE}\`
             WHERE partnerid <=> ?
               AND projectid = ?
               AND project_url_id = ?
               AND LOWER(UserId) = LOWER(?)
             ORDER BY id DESC
             LIMIT 1`,
            [partnerid, projectid, project_url_id, UserId]
        );
        return rows[0] || null;
    },

    /** Any row for this partner/project/url + InitalIP (any UserId). */
    findByInitialIp: async ({ partnerid, projectid, project_url_id, InitalIP }) => {
        const [rows] = await db.execute(
            `SELECT *
             FROM \`${TABLE}\`
             WHERE partnerid <=> ?
               AND projectid = ?
               AND project_url_id = ?
               AND InitalIP = ?
             ORDER BY id DESC
             LIMIT 1`,
            [partnerid, projectid, project_url_id, InitalIP]
        );
        return rows[0] || null;
    },
createInitiated: async ({ partnerid, projectid, project_url_id, UserId, InitalIP }) => {
    await SurveyData.ensureIndex();
    const { country } = getLocationFromIp(InitalIP);

    const [result] = await db.execute(
        `INSERT INTO \`${TABLE}\`
         (partnerid, projectid, project_url_id, UserId, InitalIP, GeoLocation, StartDate, Status)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [partnerid, projectid, project_url_id, UserId, InitalIP, country, STATUS_INITIATED]
    );
    return result.insertId;
},

    /**
     * Finalize survey activity: set Status, FinalIP, EndDate.
     * Only updates when current Status is Initiated or active.
     */
    finalizeStatus: async ({ partnerid, projectid, project_url_id, UserId, Status, FinalIP }) => {
        const [existing] = await db.execute(
            `SELECT id, Status
             FROM \`${TABLE}\`
             WHERE partnerid <=> ?
               AND projectid = ?
               AND project_url_id = ?
               AND LOWER(UserId) = LOWER(?)
             ORDER BY id DESC
             LIMIT 1`,
            [partnerid, projectid, project_url_id, UserId]
        );

        if (!existing[0]) return null;

        const [result] = await db.execute(
            `UPDATE \`${TABLE}\`
             SET Status = ?, FinalIP = ?, EndDate = NOW()
             WHERE id = ?
               AND LOWER(Status) IN ('initiated', 'active')`,
            [Status, FinalIP, existing[0].id]
        );

        if (!result.affectedRows) {
            const current = await SurveyData.getById(existing[0].id);
            return { alreadyFilled: true, currentStatus: current?.Status || existing[0].Status };
        }

        const row = await SurveyData.getById(existing[0].id);
        return { alreadyFilled: false, row };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM \`${TABLE}\` WHERE id = ? LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    },

    getId: async (projectid,project_url_id) => {
        const [rows] = await db.execute(
            `SELECT id,UserId FROM \`${TABLE}\` WHERE projectid = ? AND project_url_id = ? LIMIT 1`,
            [projectid,project_url_id]
        );
        return rows[0] || null;
    },

    getCompletedSurveysByProjectUrl: async ({ projectid, project_url_id }) => {
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS completedSurveys
             FROM \`${TABLE}\` sd
             WHERE sd.projectid = ?
               AND sd.project_url_id = ?
               AND LOWER(sd.Status) = 'completed'
               AND EXISTS (
                    SELECT 1
                    FROM supplier_mapping sm
                    WHERE sm.projectid = sd.projectid
                      AND sm.projectUrlId = sd.project_url_id
                      AND sm.partnerid <=> sd.partnerid
                      AND sm.deleted_at IS NULL
               )`,
            [projectid, project_url_id]
        );
        return Number(rows[0]?.completedSurveys || 0);
    },

   
    getProjectReport: async (project_id, { partner_id = null } = {}) => {
        const params = [project_id];
        let partnerSql = '';
        if (partner_id != null && partner_id !== '') {
            partnerSql = ' AND sd.partnerid = ?';
            params.push(partner_id);
        }

        const [rows] = await db.execute(
            `SELECT
                sm.id AS supplier_row_id,
                sd.partnerid AS supplier_id,
                p.name AS supplier_name,
                sm.partner_code AS supplier_code,
                proj.Clients AS client_id,
                sd.UserId AS supplier_identifier,
                sd.Status AS status,
                sd.StartDate AS survey_start_date,
                sd.EndDate AS survey_end_date,
                CASE
                    WHEN sd.StartDate IS NOT NULL AND sd.EndDate IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, sd.StartDate, sd.EndDate)
                    ELSE NULL
                END AS loi_minutes,
                sd.InitalIP AS ip_address,
                sd.GeoLocation AS country,
                sm.IsTest AS is_test_link
             FROM \`${TABLE}\` sd
             LEFT JOIN supplier_mapping sm
                ON sm.partnerid <=> sd.partnerid AND sm.projectid = sd.projectid
             LEFT JOIN partners p ON p.id = sd.partnerid
             LEFT JOIN project_Info proj ON proj.id = sd.projectid
             WHERE sd.projectid = ? ${partnerSql}
             ORDER BY sd.id DESC`,
            params
        );
        return rows;
    },

    getSupplierReport: async ({
        project_id,
        partner_id,
        page = 1,
        limit = 10,
        paginate = true
    }) => {
        const p = Math.max(parseInt(page, 10) || 1, 1);
        const l = Math.max(parseInt(limit, 10) || 10, 1);
        const offset = (p - 1) * l;

        const baseParams = [project_id, partner_id];
        const [countRows] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM \`${TABLE}\` sd
             WHERE sd.projectid = ?
               AND sd.partnerid = ?`,
            baseParams
        );
        const total = Number(countRows?.[0]?.total || 0);

        const query = `SELECT
                sd.partnerid AS supplierId,
                sd.partnerid AS partnerId,
                p.name AS partnerName,
                COALESCE(c.name, pi.Clients) AS clientName,
                sd.UserId AS partnersIdentifier,
                sd.Status AS status,
                sd.StartDate AS surveyStartDate,
                sd.EndDate AS surveyEndDate,
                pui.\`LOI(Minute)\` AS LOI,
                sd.InitalIP AS ipAddress,
                sd.FinalIP AS finalIp,
                sm.IsTest AS isTestLink,
                sd.project_url_id AS projectUrlId,
                (
                    SELECT pmu.VenderURL
                    FROM project_mutiple_Url pmu
                    WHERE pmu.project_id = sd.projectid
                      AND pmu.project_url_id = sd.project_url_id
                      AND pmu.partner_id = sd.partnerid
                      AND pmu.VenderURL IS NOT NULL
                      AND pmu.VenderURL <> ''
                      AND (
                            LOWER(COALESCE(pmu.Vender_UserName, '')) = LOWER(COALESCE(sd.UserId, ''))
                            OR pmu.Vender_UserName IS NULL
                            OR TRIM(pmu.Vender_UserName) = ''
                      )
                    ORDER BY
                        CASE
                            WHEN LOWER(COALESCE(pmu.Vender_UserName, '')) = LOWER(COALESCE(sd.UserId, '')) THEN 0
                            ELSE 1
                        END,
                        pmu.id ASC
                    LIMIT 1
                ) AS multiLinkUrl
             FROM \`${TABLE}\` sd
             LEFT JOIN project_Info pi
               ON pi.id = sd.projectid
             LEFT JOIN clients c
               ON (c.id = pi.Clients OR c.name = pi.Clients)
             LEFT JOIN partners p
               ON p.id = sd.partnerid
             LEFT JOIN project_url_Info pui
               ON pui.id = sd.project_url_id
             LEFT JOIN supplier_mapping sm
               ON sm.projectid = sd.projectid
              AND sm.partnerid <=> sd.partnerid
              AND sm.projectUrlId = sd.project_url_id
              AND sm.deleted_at IS NULL
             WHERE sd.projectid = ?
               AND sd.partnerid = ?
             ORDER BY sd.id DESC`;

        if (!paginate) {
            const [rows] = await db.execute(query, baseParams);
            return { rows, total };
        }

        const [rows] = await db.query(`${query} LIMIT ? OFFSET ?`, [...baseParams, Number(l), Number(offset)]);
        return {
            rows,
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l)
        };
    }
};

export default SurveyData;
