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

        const [result] = await db.execute(
            `INSERT INTO surveys (survey_id, project_name, client_id, project_manager_id, project_country,
             description, sales_manager_id, sales_project_id, loi, ir, sample_size, currency,
             start_date, end_date, link_type, term_point, comp_point, notes, cpi, live_url, test_url, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                survey_id, project_name, client_id || null, project_manager_id || null,
                project_country || null, description || null, sales_manager_id || null,
                sales_project_id || null, loi || null, ir || null, sample_size || null,
                currency || null, start_date || null, end_date || null, link_type || null,
                term_point || null, comp_point || null, notes || null, cpi || null,
                live_url || null, test_url || null, status || 'active', created_by || null
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

        const [rows] = await db.query(
            `SELECT s.id, s.survey_id, s.project_name, s.start_date, s.end_date, s.status,
             c.name AS client_name, c.id AS client_code,
             pm.name AS project_manager_name
             FROM surveys s
             LEFT JOIN PaperWardb.clients c ON s.client_id = c.id
             LEFT JOIN project_managers pm ON s.project_manager_id = pm.id
             ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM surveys s
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
    }
};

export default Survey;