import { db } from '../config/db.js';

const ProjectMultipleUrl = {

    create: async (data) => {
        const { project_id, project_url_id, Live_Link, VenderURL, Venderid_Userid, UserType, Status } = data;
        const [result] = await db.execute(
            `INSERT INTO project_mutiple_Url (project_id, project_url_id, Live_Link, VenderURL, Venderid_Userid, UserType, Status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [project_id, project_url_id || null, Live_Link || null, VenderURL || null, Venderid_Userid || null, UserType || null, Status || 'active']
        );
        return result.insertId;
    },

    getByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_mutiple_Url WHERE project_id = ?`, [project_id]
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_mutiple_Url WHERE id = ?`, [id]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE project_mutiple_Url SET ${fields} WHERE id = ?`,
            [...Object.values(data), id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM project_mutiple_Url WHERE id = ?`, [id]
        );
        return result;
    }
};

export default ProjectMultipleUrl;