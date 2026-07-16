import { db } from '../config/db.js';

const ProjectUrl = {

    create: async (data) => {
        const {
            project_id, description, loi, ir, country, cpi, sample_size,
            start_date, end_date, status, live_link, test_link,
            geo_location, url_protection, unique_ip, pre_screen,
            language, prescreen_id, prescreen_name,
            termination_point, completion_point, action_by
        } = data;

        const [result] = await db.execute(
            `INSERT INTO project_url_Info
             (project_id, description, \`LOI(Minute)\`, \`IR(%)\`, country, CPI, SampleSize,
              Start_Date, End_Date, Status, Live_Link, Test_Link, GeoLocation, UrlProtection,
              UniqueIP, PreScreen, Language, PreScreenid, PreScreenName,
              TerminationPoint, CompletionPoint, action_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                project_id, description || null, loi || null, ir || null, country || null,
                cpi || null, sample_size || null, start_date || null, end_date || null,
                status || 'active', live_link || null, test_link || null,
                geo_location ? 1 : 0, url_protection ? 1 : 0, unique_ip ? 1 : 0,
                pre_screen ? 1 : 0, language || null, prescreen_id || null, prescreen_name || null,
                termination_point || null, completion_point || null, action_by || null
            ]
        );
        return result.insertId;
    },

    getByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE project_id = ? AND deleted_at IS NULL LIMIT 1`,
            [project_id]
        );
        return rows[0] || null;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        // map friendly keys to actual DB column names
        const columnMap = {
            description: 'description', loi: '`LOI(Minute)`', ir: '`IR(%)`',
            country: 'country', cpi: 'CPI', sample_size: 'SampleSize',
            start_date: 'Start_Date', end_date: 'End_Date', status: 'Status',
            live_link: 'Live_Link', test_link: 'Test_Link',
            geo_location: 'GeoLocation', url_protection: 'UrlProtection',
            unique_ip: 'UniqueIP', pre_screen: 'PreScreen', language: 'Language',
            prescreen_id: 'PreScreenid', prescreen_name: 'PreScreenName',
            termination_point: 'TerminationPoint', completion_point: 'CompletionPoint'
        };

        const setClauses = [];
        const values = [];
        for (const key of Object.keys(data)) {
            const column = columnMap[key] || key; // fallback: use key as-is if already a real column name
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

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE project_url_Info SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    },
};

export default ProjectUrl;