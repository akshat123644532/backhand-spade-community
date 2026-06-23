import { db } from '../config/db.js';

const Country = {
    getAll: async ({ search = '' } = {}) => {
        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (name LIKE ? OR calling_code LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        const [rows] = await db.execute(
            `SELECT country_id, name, calling_code FROM countries ${where} ORDER BY name ASC`,
            params
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT country_id, name, calling_code FROM countries WHERE country_id = ?`,
            [id]
        );
        return rows[0] || null;
    }
};

export default Country;