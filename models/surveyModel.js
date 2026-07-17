import { db } from '../config/db.js';

const Survey = {

    generateSurveyId: async () => {
        const [rows] = await db.execute(`SELECT survey_id FROM surveys ORDER BY id DESC LIMIT 1`);
        if (!rows.length) return 'SRV001';
        const last = rows[0].survey_id.replace('SRV', '');
        const num = parseInt(last) + 1;
        return `SRV${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const {
            survey_id, project_name, client_id, project_manager_id, project_country,
            description, sales_manager_id, sales_project_id, loi, ir, sample_size,
            currency, start_date, end_date, link_type, term_point, comp_point,
            notes, cpi, live_url, test_url, status, created_by
        } = data;

        const form_url = `https://yourdomain.com/forms/${survey_id}`;

        const [result] = await db.execute(
            `INSERT INTO surveys (survey_id, project_name, client_id, project_manager_id, project_country,
             description, sales_manager_id, sales_project_id, loi, ir, sample_size, currency,
             start_date, end_date, link_type, term_point, comp_point, notes, cpi, live_url, test_url, form_url, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                survey_id, project_name, client_id || null, project_manager_id || null,
                project_country || null, description || null, sales_manager_id || null,
                sales_project_id || null, loi || null, ir || null, sample_size || null,
                currency || null, start_date || null, end_date || null, link_type || null,
                term_point || null, comp_point || null, notes || null, cpi || null,
                live_url || null, test_url || null, form_url,
                status || 'active', created_by || null
            ]
        );
        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE s.deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND (s.project_name LIKE ? OR s.survey_id LIKE ? OR c.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND s.status = ?`;
            params.push(status);
        }

        // Comment: Replace hardcoded PaperWardb.* schema names with env-configured DB/schema for portability across environments.
        const [rows] = await db.query(
            `SELECT s.id, s.survey_id, s.project_name, s.start_date, s.end_date, s.status,
             s.loi, s.ir, s.sample_size, s.cpi, s.currency, s.form_url,
             c.name AS client_name, c.id AS client_code,
             pm.name AS project_manager_name,
             GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') AS partner_names
             FROM surveys s
             LEFT JOIN PaperWardb.clients c ON s.client_id = c.id
             LEFT JOIN project_managers pm ON s.project_manager_id = pm.id
             LEFT JOIN survey_partners spp ON s.survey_id = spp.survey_id
             LEFT JOIN partners p ON spp.partner_id = p.id
             ${where}
             GROUP BY s.id
             ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(DISTINCT s.id) as total FROM surveys s
             LEFT JOIN PaperWardb.clients c ON s.client_id = c.id
             ${where}`, params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT s.*,
             c.name AS client_name,
             pm.name AS project_manager_name,
             sm.name AS sales_manager_name,
             sp.client_name AS sales_project_name
             FROM surveys s
             LEFT JOIN PaperWardb.clients c ON s.client_id = c.id
             LEFT JOIN project_managers pm ON s.project_manager_id = pm.id
             LEFT JOIN sales_managers sm ON s.sales_manager_id = sm.id
             LEFT JOIN sales_projects sp ON s.sales_project_id = sp.id
             WHERE s.id = ? AND s.deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        // Comment: Guard empty update payloads and use a shared safe SQL update helper to avoid invalid dynamic SET clauses.
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE surveys SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE surveys SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    },

    getEligiblePartners: async (surveyId) => {
        const [surveyRows] = await db.execute(
            `SELECT project_country, sample_size, loi, ir, currency, start_date, end_date, comp_point, term_point
             FROM surveys WHERE id = ? AND deleted_at IS NULL`,
            [surveyId]
        );
        if (!surveyRows.length) return [];

        const survey = surveyRows[0];
        const params = [];
        let where = `WHERE p.status = 'active' AND p.deleted_at IS NULL`;

        if (survey.project_country) {
            where += ` AND p.country = ?`;
            params.push(survey.project_country);
        }
        if (survey.sample_size) {
            where += ` AND (p.panel_size IS NULL OR CAST(p.panel_size AS UNSIGNED) >= ?)`;
            params.push(survey.sample_size);
        }
        if (survey.comp_point) {
            where += ` AND (p.complete_val IS NULL OR CAST(p.complete_val AS UNSIGNED) = ?)`;
            params.push(survey.comp_point);
        }
        if (survey.term_point) {
            where += ` AND (p.terminate_val IS NULL OR CAST(p.terminate_val AS UNSIGNED) = ?)`;
            params.push(survey.term_point);
        }
        if (survey.start_date && survey.end_date) {
            where += `
                AND p.id NOT IN (
                    SELECT sp2.partner_id
                    FROM survey_partners sp2
                    JOIN surveys s2 ON sp2.survey_id = s2.survey_id
                    WHERE sp2.status = 'active'
                      AND s2.deleted_at IS NULL
                      AND s2.id != ?
                      AND s2.start_date <= ? AND s2.end_date >= ?
                )
            `;
            params.push(surveyId, survey.end_date, survey.start_date);
        }

        const [partners] = await db.query(
            `SELECT p.id, p.code, p.name, p.email, p.country,
                p.panel_size, p.complete_val, p.terminate_val,
                p.over_quota_val, p.quality_term_val, p.survey_close_val,
                p.website_url, p.status
             FROM partners p
             ${where}
             ORDER BY CAST(p.panel_size AS UNSIGNED) DESC`,
            params
        );
        return partners;
    },

    assignPartners: async (survey_id, partnerIds = []) => {
        await db.execute(`DELETE FROM survey_partners WHERE survey_id = ?`, [survey_id]);
        if (!partnerIds.length) return;
        const values = partnerIds.map(pid => [survey_id, pid]);
        await db.query(`INSERT INTO survey_partners (survey_id, partner_id) VALUES ?`, [values]);
    },

    getAssignedPartners: async (survey_id) => {
        const [rows] = await db.execute(
            `SELECT p.id, p.code, p.name, p.email, p.country,
                p.panel_size, p.website_url, p.status,
                sp.allocated_size, sp.status AS assignment_status,
                sp.created_at AS assigned_at
             FROM survey_partners sp
             JOIN partners p ON sp.partner_id = p.id
             WHERE sp.survey_id = ? AND p.deleted_at IS NULL
             ORDER BY sp.created_at ASC`,
            [survey_id]
        );
        return rows;
    },

    removePartner: async (survey_id, partner_id) => {
        const [result] = await db.execute(
            `DELETE FROM survey_partners WHERE survey_id = ? AND partner_id = ?`,
            [survey_id, partner_id]
        );
        return result;
    },

    updatePartnerAllocation: async (survey_id, partner_id, allocated_size) => {
        const [result] = await db.execute(
            `UPDATE survey_partners SET allocated_size = ? WHERE survey_id = ? AND partner_id = ?`,
            [allocated_size, survey_id, partner_id]
        );
        return result;
    },

    getRecontacts: async () => {
        const [rows] = await db.execute(`
            SELECT s.*,
                   c.name AS client_name,
                   pm.name AS project_manager_name
            FROM surveys s
            LEFT JOIN PaperWardb.clients c ON c.id = s.client_id
            LEFT JOIN project_managers pm ON pm.id = s.project_manager_id
            WHERE s.survey_type = 'recontact'
            AND s.deleted_at IS NULL
            ORDER BY s.created_at DESC
        `);
        return rows;
    },

    getRecontactsBySurvey: async (parentSurveyId) => {
        const [rows] = await db.execute(`
            SELECT *
            FROM surveys
            WHERE parent_survey_id = ?
            AND deleted_at IS NULL
        `, [parentSurveyId]);
        return rows;
    },
};

export default Survey;


