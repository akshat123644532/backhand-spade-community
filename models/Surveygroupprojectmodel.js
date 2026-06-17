import { db } from '../config/db.js';

const SurveyGroupProject = {

    create: async (data) => {
        const { project_name, description, notes, status, created_by } = data;
        const [result] = await db.execute(
            `INSERT INTO survey_group_projects (project_name, description, notes, status, created_by) VALUES (?, ?, ?, ?, ?)`,
            [project_name, description || null, notes || null, status || 'active', created_by || null]
        );
        return result.insertId;
    },

    addClients: async (survey_group_project_id, client_ids) => {
        for (const client_id of client_ids) {
            await db.execute(
                `INSERT INTO survey_group_project_clients (survey_group_project_id, client_id) VALUES (?, ?)`,
                [survey_group_project_id, client_id]
            );
        }
    },

    deleteClients: async (survey_group_project_id) => {
        await db.execute(
            `DELETE FROM survey_group_project_clients WHERE survey_group_project_id = ?`,
            [survey_group_project_id]
        );
    },

    // ─── SURVEYS LINK ────────────────────────────
    addSurveys: async (survey_group_project_id, survey_ids) => {
        for (const survey_id of survey_ids) {
            await db.execute(
                `INSERT IGNORE INTO survey_group_project_surveys (survey_group_project_id, survey_id) VALUES (?, ?)`,
                [survey_group_project_id, survey_id]
            );
        }
    },

    deleteSurveys: async (survey_group_project_id) => {
        await db.execute(
            `DELETE FROM survey_group_project_surveys WHERE survey_group_project_id = ?`,
            [survey_group_project_id]
        );
    },

    removeSurvey: async (survey_group_project_id, survey_id) => {
        await db.execute(
            `DELETE FROM survey_group_project_surveys WHERE survey_group_project_id = ? AND survey_id = ?`,
            [survey_group_project_id, survey_id]
        );
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE sgp.deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND sgp.project_name LIKE ?`;
            params.push(`%${search}%`);
        }
        if (status) {
            where += ` AND sgp.status = ?`;
            params.push(status);
        }

        const [rows] = await db.query(
            `SELECT sgp.id, sgp.project_name, sgp.status, sgp.created_at,
             GROUP_CONCAT(DISTINCT c.name SEPARATOR ', ') AS client_names,
             GROUP_CONCAT(DISTINCT s.project_name SEPARATOR ', ') AS survey_names
             FROM survey_group_projects sgp
             LEFT JOIN survey_group_project_clients sgpc ON sgp.id = sgpc.survey_group_project_id
             LEFT JOIN PaperWardb.clients c ON sgpc.client_id = c.id
             LEFT JOIN survey_group_project_surveys sgps ON sgp.id = sgps.survey_group_project_id
             LEFT JOIN surveys s ON sgps.survey_id = s.survey_id
             ${where}
             GROUP BY sgp.id
             ORDER BY sgp.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM survey_group_projects sgp ${where}`, params
        );
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM survey_group_projects WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        if (!rows[0]) return null;

        const [clients] = await db.execute(
            `SELECT c.id, c.name, c.email FROM survey_group_project_clients sgpc
             JOIN PaperWardb.clients c ON sgpc.client_id = c.id
             WHERE sgpc.survey_group_project_id = ?`,
            [id]
        );

        const [surveys] = await db.execute(
            `SELECT s.id, s.survey_id, s.project_name, s.project_country,
             s.start_date, s.end_date, s.loi, s.ir, s.sample_size,
             s.cpi, s.currency, s.status
             FROM survey_group_project_surveys sgps
             JOIN surveys s ON sgps.survey_id = s.survey_id
             WHERE sgps.survey_group_project_id = ? AND s.deleted_at IS NULL`,
            [id]
        );

        return { ...rows[0], clients, surveys };
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE survey_group_projects SET ${fields}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE survey_group_projects SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE survey_group_projects SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default SurveyGroupProject;