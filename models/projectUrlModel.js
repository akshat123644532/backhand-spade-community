import { db } from '../config/db.js';
import crypto from 'crypto';

const ProjectUrl = {

    // Alphanumeric code, project_id ke saath prefix — jaise PID20A7X9K2Z1
    generateUrlCode: async (project_id, conn = db) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let exists = true;

        while (exists) {
            let randomPart = '';
            for (let i = 0; i < 8; i++) {
                randomPart += chars[crypto.randomInt(0, chars.length)];
            }
            code = `PID${project_id}${randomPart}`;

            const [rows] = await conn.execute(
                `SELECT id FROM project_url_Info WHERE project_url_code = ?`, [code]
            );
            exists = rows.length > 0;
        }

        return code;
    },

    create: async (data, conn = db) => {
        const {
            project_id, description, LOI, IR, country, CPI, SampleSize,
            Start_Date, End_Date, Status, Live_Link, Test_Link,
            GeoLocation, UrlProtection, UniqueIP, PreScreen, FraudDetection,
            Language, PreScreenid, PreScreenName,
            TerminationPoint, CompletionPoint, ValidatePoint,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
            action_by
        } = data;

        if (!project_id) {
            const err = new Error('project_id is required to generate project_url_code!');
            err.statusCode = 400;
            throw err;
        }

        const project_url_code = await ProjectUrl.generateUrlCode(project_id, conn);

        const [result] = await conn.execute(
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
        return { id: result.insertId, project_url_code };
    },

    getByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE project_id = ? AND (deleted_at IS NULL)`, [project_id]
        );
        return rows;
    },

    getSampleSizeByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT COALESCE(SUM(SampleSize), 0) AS sampleSize
             FROM project_url_Info
             WHERE project_id = ? AND deleted_at IS NULL`,
            [project_id]
        );
        return Number(rows[0]?.sampleSize || 0);
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const columnMap = {
            LOI: '`LOI(Minute)`',
            IR: '`IR(%)`'
        };

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
    },

    toggleLinkMode: async (id, link_mode) => {
        const [result] = await db.execute(
            `UPDATE project_url_Info SET link_mode = ?, updated_at = NOW() WHERE id = ?`,
            [link_mode, id]
        );
        return result;
    },

    getActiveLink: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, project_id, link_mode, Test_Link, Live_Link, Status
             FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        if (!rows.length) return null;

        const urlInfo = rows[0];
        const activeLink = urlInfo.link_mode === 'live' ? urlInfo.Live_Link : urlInfo.Test_Link;

        return {
            id: urlInfo.id,
            project_id: urlInfo.project_id,
            link_mode: urlInfo.link_mode,
            active_link: activeLink
        };
    }
};

export default ProjectUrl;