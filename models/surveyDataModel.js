import { db } from '../config/db.js';
import { checkIpFraud } from '../services/Scamalyticsservice.js';
import IpDetection from './Ipdetectionmodel.js';
import { resolveGeoLocationLabel } from '../utils/linkSecurityHelper.js';
const TABLE = 'survery_data';
const STATUS_INITIATED = 'Initiated';

let indexReady = false;

export const isInitiatedStatus = (status) =>
    String(status || '').trim().toLowerCase() === 'initiated';

const isEmptyGeoLocation = (value) =>
    value === null || value === undefined || String(value).trim() === '';

const SurveyData = {
    STATUS_INITIATED,
    isInitiatedStatus,
    isEmptyGeoLocation,

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
     * Serialize initiations for a partner/project/url scope (UserId + conditional UniqueIP races).
     * Uses MySQL named locks — no schema change required.
     */
    // withInitLock: async (lockKey, fn) => {
    //     const name = String(lockKey || 'survey_init').slice(0, 64);
    //     const [rows] = await db.query('SELECT GET_LOCK(?, 10) AS acquired', [name]);
    //     if (!Number(rows?.[0]?.acquired)) {
    //         const err = new Error('Survey initiation is busy. Please retry.');
    //         err.statusCode = 503;
    //         err.code = 'INIT_LOCK_TIMEOUT';
    //         throw err;
    //     }
    //     try {
    //         return await fn();
    //     } finally {
    //         try {
    //             await db.query('SELECT RELEASE_LOCK(?)', [name]);
    //         } catch {
    //             // ignore release errors
    //         }
    //     }
    // },

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
    findByUserId: async ({
        partnerid,
        projectid,
        project_url_id,
        UserId
    }) => {
    
        const [rows] = await db.execute(
            `SELECT *
             FROM \`${TABLE}\`
             WHERE partnerid <=> ?
               AND projectid = ?
               AND project_url_id = ?
               AND LOWER(UserId) = LOWER(?)
             ORDER BY id DESC
             LIMIT 1`,
            [
                partnerid,
                projectid,
                project_url_id,
                UserId
            ]
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

    /**
     * Resolve UserId from an existing Initiated survey_data row when client omits uid.
     * Prefer same IP match; otherwise latest Initiated for the project URL scope.
     */
    findLatestInitiatedUserId: async ({ partnerid, projectid, project_url_id, InitalIP = null }) => {
        if (InitalIP) {
            const [byIp] = await db.execute(
                `SELECT id, UserId, InitalIP, Status
                 FROM \`${TABLE}\`
                 WHERE partnerid <=> ?
                   AND projectid = ?
                   AND project_url_id = ?
                   AND InitalIP = ?
                   AND Status = ?
                 ORDER BY id DESC
                 LIMIT 1`,
                [partnerid, projectid, project_url_id, InitalIP, STATUS_INITIATED]
            );
            if (byIp[0]?.UserId) return byIp[0];
        }

        const [rows] = await db.execute(
            `SELECT id, UserId, InitalIP, Status
             FROM \`${TABLE}\`
             WHERE partnerid <=> ?
               AND projectid = ?
               AND project_url_id = ?
               AND Status = ?
             ORDER BY id DESC
             LIMIT 1`,
            [partnerid, projectid, project_url_id, STATUS_INITIATED]
        );
        return rows[0] || null;
    },

  createInitiated: async ({
    partnerid,
    projectid,
    project_url_id,
    UserId,
    InitalIP
}) => {

    // Resolve GeoLocation from IP.
    // Geo lookup failure should NOT stop survey initiation.
    let geoLabel = null;

    try {
        geoLabel =
            await resolveGeoLocationLabel(
                InitalIP
            );
    } catch (error) {
        console.warn(
            '[SurveyData] GeoLocation lookup failed:',
            error.message
        );

        geoLabel = null;
    }

    const [result] = await db.execute(
        `INSERT INTO \`${TABLE}\`
        (
            partnerid,
            projectid,
            project_url_id,
            UserId,
            InitalIP,
            GeoLocation,
            StartDate,
            Status
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
            partnerid,
            projectid,
            project_url_id,
            UserId,
            InitalIP,
            geoLabel,
            STATUS_INITIATED
        ]
    );

    const insertId = result.insertId;

    // 👇 NEW: run fraud/IP detection and store it against this survey_data row.
    // Failure here should NOT stop survey initiation, so it's wrapped in try/catch.
    try {
        const fraudResult = await checkIpFraud(InitalIP);
        await IpDetection.insert(insertId, fraudResult);
    } catch (error) {
        console.warn(
            '[SurveyData] Scamalytics/IP detection failed:',
            error.message
        );
    }

    return insertId;
},
   

   
    backfillGeoLocationIfEmpty: async ({ id, ip }) => {
        const row = await SurveyData.getById(id);
        if (!row) return null;
        if (!isEmptyGeoLocation(row.GeoLocation)) return row;

        let geoLabel = null;
        try {
            geoLabel = await resolveGeoLocationLabel(ip || row.InitalIP);
        } catch {
            geoLabel = null;
        }
        if (!geoLabel) return row;

        await db.execute(
            `UPDATE \`${TABLE}\`
             SET GeoLocation = ?
             WHERE id = ?
               AND (GeoLocation IS NULL OR TRIM(GeoLocation) = '')`,
            [geoLabel, id]
        );

        return (await SurveyData.getById(id)) || { ...row, GeoLocation: geoLabel };
    },

    
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

    getId: async (projectid, project_url_id, UserId) => {
        if (UserId != null && String(UserId).trim() !== '') {
            const [rows] = await db.execute(
                `SELECT id, UserId FROM \`${TABLE}\`
                 WHERE projectid = ? AND project_url_id = ? AND LOWER(UserId) = LOWER(?)
                 ORDER BY id DESC
                 LIMIT 1`,
                [projectid, project_url_id, String(UserId).trim()]
            );
            return rows[0] || null;
        }
        const [rows] = await db.execute(
            `SELECT id, UserId FROM \`${TABLE}\`
             WHERE projectid = ? AND project_url_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [projectid, project_url_id]
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
   
getTerminatedSurveysByProjectUrl: async ({ projectid, project_url_id }) => {
    const [rows] = await db.execute(
        `SELECT COUNT(*) AS terminatedSurveys
         FROM \`${TABLE}\` sd
         WHERE sd.projectid = ?
           AND sd.project_url_id = ?
           AND LOWER(sd.Status) = 'terminated'
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
    return Number(rows[0]?.terminatedSurveys || 0);
},

getSupplierSummaryByProjectId: async (project_id) => {
    const [rows] = await db.execute(
        `SELECT
            agg.partnerid AS supplier_id,
            agg.total_respondent,
            agg.complete,
            agg.terminate,
            agg.over_quota,
            agg.quality_term,
            agg.dropout,
            sm.partner_code AS supplier_code,
            p.name AS supplier_name
         FROM (
            SELECT
                partnerid,
                COUNT(*) AS total_respondent,
                SUM(CASE WHEN LOWER(Status) = 'completed' THEN 1 ELSE 0 END) AS complete,
                SUM(CASE WHEN LOWER(Status) = 'terminated' THEN 1 ELSE 0 END) AS terminate,
                SUM(CASE WHEN LOWER(Status) IN ('overquota','over quota') THEN 1 ELSE 0 END) AS over_quota,
                SUM(CASE WHEN LOWER(Status) IN ('qualityterm','quality term') THEN 1 ELSE 0 END) AS quality_term,
                SUM(CASE WHEN LOWER(Status) NOT IN ('completed','terminated','overquota','over quota','qualityterm','quality term','initiated') THEN 1 ELSE 0 END) AS dropout,
                MIN(id) AS first_id
            FROM \`${TABLE}\`
            WHERE projectid = ?
            GROUP BY partnerid
         ) agg
         LEFT JOIN (
            SELECT partnerid, MIN(partner_code) AS partner_code, MIN(id) AS sm_id
            FROM supplier_mapping
            WHERE projectid = ? AND deleted_at IS NULL
            GROUP BY partnerid
         ) sm ON sm.partnerid <=> agg.partnerid
         LEFT JOIN partners p ON p.id = agg.partnerid
         ORDER BY agg.first_id ASC`,
        [project_id, project_id]
    );

    return rows.map((r, idx) => ({
        s_no: idx + 1,
        supplier_id: r.supplier_id,
        supplier_code: r.supplier_code || (r.supplier_id != null ? `P${r.supplier_id}` : 'DIRECT'),
        supplier_name: r.supplier_name || (r.supplier_id != null ? 'Unknown' : 'Direct / No Partner'),
        total_respondent: Number(r.total_respondent || 0),
        complete: Number(r.complete || 0),
        terminate: Number(r.terminate || 0),
        over_quota: Number(r.over_quota || 0),
        quality_term: Number(r.quality_term || 0),
        dropout: Number(r.dropout || 0)
    }));
},
getSupplierSummaryByProjectId: async (project_id) => {
    const [rows] = await db.execute(
        `SELECT
            sm.id AS mapping_id,
            sm.partnerid AS supplier_id,
            sm.partner_code AS supplier_code,
            p.name AS supplier_name,
            sm.quota,
            COALESCE(agg.total_respondent, 0) AS total_respondent,
            COALESCE(agg.complete, 0) AS complete,
            COALESCE(agg.terminate, 0) AS terminate,
            COALESCE(agg.over_quota, 0) AS over_quota,
            COALESCE(agg.quality_term, 0) AS quality_term,
            COALESCE(agg.dropout, 0) AS dropout
         FROM supplier_mapping sm
         LEFT JOIN partners p ON p.id = sm.partnerid
         LEFT JOIN (
            SELECT
                partnerid,
                COUNT(*) AS total_respondent,
                SUM(CASE WHEN LOWER(Status) = 'completed' THEN 1 ELSE 0 END) AS complete,
                SUM(CASE WHEN LOWER(Status) = 'terminated' THEN 1 ELSE 0 END) AS terminate,
                SUM(CASE WHEN LOWER(Status) IN ('overquota','over quota') THEN 1 ELSE 0 END) AS over_quota,
                SUM(CASE WHEN LOWER(Status) IN ('qualityterm','quality term') THEN 1 ELSE 0 END) AS quality_term,
                SUM(CASE WHEN LOWER(Status) NOT IN ('completed','terminated','overquota','over quota','qualityterm','quality term','initiated') THEN 1 ELSE 0 END) AS dropout
            FROM \`${TABLE}\`
            WHERE projectid = ?
            GROUP BY partnerid
         ) agg ON agg.partnerid <=> sm.partnerid
         WHERE sm.projectid = ?
           AND sm.deleted_at IS NULL
         ORDER BY sm.id ASC`,
        [project_id, project_id]
    );

    return rows.map((r, idx) => ({
        s_no: idx + 1,
        supplier_id: r.supplier_id,
        supplier_code: r.supplier_code || (r.supplier_id != null ? `P${r.supplier_id}` : 'DIRECT'),
        supplier_name: r.supplier_name || 'Unknown',
        quota: Number(r.quota || 0),
        total_respondent: Number(r.total_respondent || 0),
        complete: Number(r.complete || 0),
        terminate: Number(r.terminate || 0),
        over_quota: Number(r.over_quota || 0),
        quality_term: Number(r.quality_term || 0),
        dropout: Number(r.dropout || 0)
    }));
},
   
getProjectReport: async (
    project_id,
    { partner_id = null, status = 'all' } = {}
) => {
    const params = [project_id];
 
    let partnerSql = '';
    let statusSql = '';
 
    if (partner_id != null && partner_id !== '') {
        partnerSql = ' AND sd.partnerid = ?';
        params.push(partner_id);
    }
 
    if (
        status &&
        String(status).trim() !== '' &&
        String(status).toLowerCase() !== 'all'
    ) {
        statusSql = ' AND LOWER(TRIM(sd.Status)) = LOWER(TRIM(?))';
        params.push(status);
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
                WHEN sd.StartDate IS NOT NULL
                     AND sd.EndDate IS NOT NULL
                THEN TIMESTAMPDIFF(
                    MINUTE,
                    sd.StartDate,
                    sd.EndDate
                )
                ELSE NULL
            END AS loi_minutes,
 
            sd.InitalIP AS ip_address,
            sd.GeoLocation AS country,
            sm.IsTest AS is_test_link,
 
            -- 👇 NEW: fraud-detection columns, pulled from the latest ip_detection row for this survey
            idt.ip_country_code AS ip_country_code,
            idt.ip_country_name AS ip_country_name,
            idt.ip_state_name AS ip_state_name,
            idt.ip_time_zone AS ip_time_zone,
            idt.is_vpn AS is_vpn,
            idt.scamalytics_score AS fraud_score,
            idt.scamalytics_risk AS fraud_risk
 
        FROM \`${TABLE}\` sd
 
        LEFT JOIN supplier_mapping sm
            ON sm.partnerid <=> sd.partnerid
            AND sm.projectid = sd.projectid
 
        LEFT JOIN partners p
            ON p.id = sd.partnerid
 
        LEFT JOIN project_Info proj
            ON proj.id = sd.projectid
 
        -- 👇 NEW: latest ip_detection row per survey_data row (in case of retries/multiple calls)
        LEFT JOIN (
            SELECT t1.*
            FROM ip_detection t1
            INNER JOIN (
                SELECT survey_data_id, MAX(id) AS max_id
                FROM ip_detection
                GROUP BY survey_data_id
            ) t2 ON t1.survey_data_id = t2.survey_data_id AND t1.id = t2.max_id
        ) idt ON idt.survey_data_id = sd.id
 
        WHERE sd.projectid = ?
        ${partnerSql}
        ${statusSql}
 
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
