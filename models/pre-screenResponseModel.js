import { db } from '../config/db.js';

const TABLE = 'survey_prescreen_response';
const STATUS_INITIATED = 'IN_PROGRESS';

const surveyPreScreenResponse = {
    STATUS_INITIATED,

    createInitiated: async ({ survey_data_id, UserId, }) => {

        const [result] = await db.execute(
            `INSERT INTO \`${TABLE}\`
             (user_id, survey_data_id, status, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())`,
            [UserId, survey_data_id, STATUS_INITIATED]
        );
        return result.insertId;
    },

    getPreScreenResponseBySurveyDataIdUserId: async (survey_data_id, UserId) => {
        const [result] = await db.execute(
            `SELECT * FROM \`${TABLE}\`
             WHERE survey_data_id = ?
               AND LOWER(user_id) = LOWER(?)
             LIMIT 1`,
            [survey_data_id, UserId]
        );
        return result[0] || null;
    },
    getPreScreenResponseIdBySurveyDataIdUserId: async (survey_data_id, UserId) => {
        const [result] = await db.execute(
            `SELECT id FROM \`${TABLE}\`
             WHERE survey_data_id = ?
               AND LOWER(user_id) = LOWER(?)
             LIMIT 1`,
            [survey_data_id, UserId]
        );
        return result[0] || null;
    },
    updateStatus: async ({ id, status }) => {
        const [result] = await db.execute(
            `UPDATE \`${TABLE}\`
             SET status = ?, updated_at = NOW()
             WHERE id = ?`,
            [status, id]
        );
    
        return result.affectedRows > 0;
    },



getPreScreenReport: async ({ projectid, is_test = null }) => {
    const params = [projectid];
    let isTestSql = '';

    if (is_test !== null && is_test !== undefined && String(is_test).trim() !== '') {
        isTestSql = ` AND sm.IsTest = ?`;
        params.push(Number(is_test) ? 1 : 0);
    }

    const [rows] = await db.execute(
        `
        SELECT
            ROW_NUMBER() OVER (ORDER BY sd.id DESC, spa.id ASC) AS serial_no,
            sd.UserId AS uid,
            sd.UserId AS user_id,
            proj.Project_Name AS project_name,
            sd.StartDate AS survey_date,
            spa.created_at AS answered_at,
            sd.partnerid AS partner_id,
            p.name AS partner_name,
            proj.Clients AS client_name,
            sd.InitalIP AS ip_address,
            spa.question_text AS question,
            spa.answer AS answer,
            spr.status AS status,

            -- 👇 NEW: fraud-detection columns, pulled from the latest ip_detection row for this survey
            idt.ip_country_code AS ip_country_code,
            idt.ip_country_name AS ip_country_name,
            idt.ip_state_name AS ip_state_name,
            idt.ip_time_zone AS ip_time_zone,
            idt.is_vpn AS is_vpn,
            idt.scamalytics_score AS fraud_score,
            idt.scamalytics_risk AS fraud_risk

        FROM survery_data sd

        INNER JOIN \`${TABLE}\` spr
            ON spr.survey_data_id = sd.id

        INNER JOIN survey_prescreen_answer spa
            ON spa.survey_prescreen_response_id = spr.id

        LEFT JOIN partners p
            ON p.id = sd.partnerid

        LEFT JOIN project_Info proj
            ON proj.id = sd.projectid

        LEFT JOIN supplier_mapping sm
            ON sm.partnerid <=> sd.partnerid
           AND sm.projectid = sd.projectid
           AND sm.projectUrlId = sd.project_url_id
           AND sm.deleted_at IS NULL

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
        ${isTestSql}

        ORDER BY sd.id DESC, spa.id ASC
        `,
        params
    );

    return rows;
},
};


export default surveyPreScreenResponse;