import { db } from '../config/db.js';

const ProjectUrl = {

    create: async (data) => {
        const {
            project_id, description, LOI, IR, country, CPI, SampleSize,
            Start_Date, End_Date, Status, Live_Link, Test_Link,
            GeoLocation, UrlProtection, UniqueIP, PreScreen, FraudDetection,
            Language, PreScreenid, PreScreenName,
            TerminationPoint, CompletionPoint, ValidatePoint,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
            action_by
        } = data;

        const [result] = await db.execute(
            `INSERT INTO project_url_Info
             (project_id, description, \`LOI(Minute)\`, \`IR(%)\`, country, CPI, SampleSize,
              Start_Date, End_Date, Status, Live_Link, Test_Link,
              GeoLocation, UrlProtection, UniqueIP, PreScreen, FraudDetection,
              Language, PreScreenid, PreScreenName,
              TerminationPoint, CompletionPoint, ValidatePoint,
              CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
              action_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                project_id, description || null, LOI || null, IR || null,
                country || null, CPI || null, SampleSize || null,
                Start_Date || null, End_Date || null, Status || 'active',
                Live_Link || null, Test_Link || null,
                GeoLocation || 0, UrlProtection || 0, UniqueIP || 0, PreScreen || 0, FraudDetection || 0,
                Language || null, PreScreenid || null, PreScreenName || null,
                TerminationPoint || null, CompletionPoint || null, ValidatePoint || null,
                CompleteURL || null, TerminateURL || null, OverQuotaURL || null, QualityTermURL || null, SurveyCloseURL || null,
                action_by || null
            ]
        );
        return result.insertId;
    },

    getByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE project_id = ? AND (deleted_at IS NULL)`, [project_id]
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        // map friendly keys to actual DB column names (LOI -> `LOI(Minute)`, IR -> `IR(%)`)
        const columnMap = {
            LOI: '`LOI(Minute)`',
            IR: '`IR(%)`'
        };

        const setClauses = [];
        const values = [];
        for (const key of Object.keys(data)) {
            const column = columnMap[key] || `\`${key}\``;
            setClauses.push(`${column} = ?`);
            values.push(data[key]);
        }
        if (!setClauses.length) return null;

        const [result] = await db.execute(
            `UPDATE project_url_Info SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
            [...values, id]
        );
        return result;
    },

    delete: async (id, deleted_by) => {
        const [result] = await db.execute(
            `UPDATE project_url_Info SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
            [deleted_by || null, id]
        );
        return result;
    }
};


export default ProjectUrl;