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
            `SELECT * FROM \`${TABLE}\` WHERE survey_data_id = ? AND user_id = ? LIMIT 1`,
            [survey_data_id, UserId]
        );
        return result[0] || null;
    },
    getPreScreenResponseIdBySurveyDataIdUserId: async (survey_data_id, UserId) => {
        const [result] = await db.execute(
            `SELECT id FROM \`${TABLE}\` WHERE survey_data_id = ? AND user_id = ? LIMIT 1`,
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

    getPreScreenReport: async ({ projectid }) => {
        const [rows] = await db.execute(
            `
            SELECT
                ROW_NUMBER() OVER (ORDER BY sd.id DESC, spa.id ASC) AS serial_no,
                sd.partnerid AS partner_id,
                p.name AS partner_name,
                proj.Clients AS client_name,
                sd.InitalIP AS ip_address,
                spa.question_text AS question,
                spa.answer AS answer,
                spr.status AS status
    
            FROM survery_data sd
    
            INNER JOIN \`${TABLE}\` spr
                ON spr.survey_data_id = sd.id
    
            INNER JOIN survey_prescreen_answer spa
                ON spa.survey_prescreen_response_id = spr.id
    
            LEFT JOIN partners p
                ON p.id = sd.partnerid
    
            LEFT JOIN project_Info proj
                ON proj.id = sd.projectid
    
            WHERE sd.projectid = ?
    
            ORDER BY sd.id DESC, spa.id ASC
            `,
            [projectid]
        );
    
        return rows;
    },
};


export default surveyPreScreenResponse;