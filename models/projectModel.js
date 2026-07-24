import { db } from '../config/db.js';
import { buildUpdateQuery } from '../utils/sqlHelper.js';

const Project = {

    generateProjectCode: async () => {
        const [rows] = await db.execute(`SELECT Project_code FROM project_Info ORDER BY id DESC LIMIT 1`);
        if (!rows.length) return 'PRJ001';
        const last = rows[0].Project_code.replace('PRJ', '');
        const num = parseInt(last) + 1;
        return `PRJ${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const { Project_Name, Clients, Project_Manager, Sales_Manager, RFQ, Project_Description, Project_Link_Type, Notes, Status, action_by } = data;
        const Project_code = await Project.generateProjectCode();

        const [result] = await db.execute(
            `INSERT INTO project_Info (Project_Name, Project_code, Clients, Project_Manager, Sales_Manager, RFQ, Project_Description, Project_Link_Type, Notes, Status, action_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [Project_Name, Project_code, Clients || null, Project_Manager || null, Sales_Manager || null, RFQ || null, Project_Description || null, Project_Link_Type || null, Notes || null, Status || 'active', action_by || null]
        );
        return { id: result.insertId, Project_code };
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE (isdeleted = 0 OR isdeleted IS NULL)`;
        const params = [];

        if (search) {
            where += ` AND (Project_Name LIKE ? OR Project_code LIKE ? OR Clients LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND Status = ?`;
            params.push(status);
        }

        const [rows] = await db.query(
            `SELECT * FROM project_Info ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM project_Info ${where}`, params
        );

        return {
            data: rows,
            total: countResult[0].total || 0,
            page: p,
            limit: l,
            totalPages: Math.ceil((countResult[0].total || 0) / l)
        };
    },
// comment solved flash back
    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_Info WHERE id = ? AND (isdeleted = 0 OR isdeleted IS NULL)`, [id]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const { sql, values } = buildUpdateQuery(
            'project_Info',
            data,
            'id = ?',
            [id],
            'updated_at = NOW()'
        );

        const [result] = await db.execute(sql, values);
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE project_Info SET isdeleted = 1, deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default Project;