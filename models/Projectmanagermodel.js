import { db } from '../config/db.js';

const ProjectManager = {

    generateCode: async () => {
        const [rows] = await db.execute(
            `SELECT code FROM project_managers ORDER BY id DESC LIMIT 1`
        );
        if (!rows.length) return 'PM001';
        const num = parseInt(rows[0].code.replace('PM', '')) + 1;
        return `PM${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const { code, name, email, password, profile_image } = data;
        const [result] = await db.execute(
            `INSERT INTO project_managers (code, name, email, password, profile_image) 
             VALUES (?, ?, ?, ?, ?)`,
            [code, name, email, password, profile_image || null]
        );
        return result;
    },

    getAll: async () => {
        const [rows] = await db.execute(
            `SELECT id, code, name, email, profile_image, status, created_at
             FROM project_managers
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC`
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, code, name, email, profile_image, status, created_at
             FROM project_managers 
             WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT id FROM project_managers WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(data), id];
        const [result] = await db.execute(
            `UPDATE project_managers SET ${fields}, updated_at = NOW() WHERE id = ?`,
            values
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE project_managers SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE project_managers SET deleted_at = NOW() WHERE id = ?`,
            [id]
        );
        return result;
    }
};

export default ProjectManager;