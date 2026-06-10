import { db } from '../config/db.js';

const Project = {
    getClients: async () => {
        const [rows] = await db.execute("SELECT id, name FROM clients");
        return rows;
    },

    getManagers: async () => {
        const [rows] = await db.execute("SELECT id, name FROM users WHERE role = 'project_manager'");
        return rows;
    },

    create: async (data) => {
        const sql = `INSERT INTO projects (client_id, project_name, project_manager_id, project_country, description, survey_id, sales_manager, sales_project) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [
            data.client_id, data.project_name, data.project_manager_id, 
            data.project_country, data.description, data.survey_id, 
            data.sales_manager, data.sales_project
        ]);
        return result.insertId;
    },

    getAll: async ({ page, limit, search }) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = "";
        const params = [];

        if (search) {
            where = "WHERE project_name LIKE ? OR survey_id LIKE ?";
            params.push(`%${search}%`, `%${search}%`);
        }

        const query = `SELECT p.*, c.name as client_name, u.name as manager_name 
                       FROM projects p 
                       LEFT JOIN clients c ON p.client_id = c.id 
                       LEFT JOIN users u ON p.project_manager_id = u.id 
                       ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`;
        
        const [rows] = await db.query(query, [...params, Number(l), Number(offset)]);
        const [count] = await db.query(`SELECT COUNT(*) as total FROM projects ${where}`, params);
        
        return { data: rows, total: count[0].total };
    }
};

export default Project;