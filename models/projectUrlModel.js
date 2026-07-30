import { db } from '../config/db.js';
import crypto from 'crypto';

const ProjectUrl = {

 
    generateUrlCode: async () => {
        let code;
        let exists = true;

        while (exists) {
            const length = Math.floor(Math.random() * 5) + 6; // 6,7,8,9,10
            const min = Math.pow(10, length - 1);
            const max = Math.pow(10, length) - 1;
            code = String(crypto.randomInt(min, max));

            const [rows] = await db.execute(
                `SELECT id FROM project_url_Info WHERE project_url_code = ?`, [code]
            );
            exists = rows.length > 0;
        }

        return code;
    },

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

       
        const project_url_code = await ProjectUrl.generateUrlCode();

        const [result] = await db.execute(
            `INSERT INTO project_url_Info
             (project_id, project_url_code, description, \`LOI(Minute)\`, \`IR(%)\`, country, CPI, SampleSize,
              Start_Date, End_Date, Status, Live_Link, Test_Link,
              GeoLocation, UrlProtection, UniqueIP, PreScreen, FraudDetection,
              Language, PreScreenid, PreScreenName,
              TerminationPoint, CompletionPoint, ValidatePoint,
              CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
              action_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                project_id, project_url_code, description || null, LOI || null, IR || null,
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

        // project_url_code kabhi update nahi hona chahiye — chahe request me aaye bhi to ignore karo
        const safeData = { ...data };
        delete safeData.project_url_code;

        const setClauses = [];
        const values = [];
        for (const key of Object.keys(safeData)) {
            const column = columnMap[key] || `\`${key}\``;
            setClauses.push(`${column} = ?`);
            values.push(safeData[key]);
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