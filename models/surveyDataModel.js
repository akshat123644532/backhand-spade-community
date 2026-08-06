import { db } from '../config/db.js';

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

    createInitiated: async ({ partnerid, projectid, project_url_id, UserId, InitalIP }) => {
        await SurveyData.ensureIndex();

        const [result] = await db.execute(
            `INSERT INTO \`${TABLE}\`
             (partnerid, projectid, project_url_id, UserId, InitalIP, StartDate, Status)
             VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
            [partnerid, projectid, project_url_id, UserId, InitalIP, STATUS_INITIATED]
        );
        return result.insertId;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM \`${TABLE}\` WHERE id = ? LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    }
};

export default SurveyData;
