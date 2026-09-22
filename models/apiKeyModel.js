import { db } from '../config/db.js';

const ApiKey = {
    create: async (apiData) => {
        const {
            api_name,
            api_label,
            api_user_id,
            api_key,
            base_url,
            endpoint,
            method,
            auth_type,
            header_name,
            status,
            description
        } = apiData;

        const [result] = await db.execute(
            `INSERT INTO api_keys
            (api_name, api_label, api_user_id, api_key, base_url, endpoint, method, auth_type, header_name, status, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                api_name,
                api_label,
                api_user_id ?? null,
                api_key,
                base_url ?? null,
                endpoint ?? null,
                method ?? 'POST',
                auth_type ?? null,
                header_name ?? null,
                status ?? 'active',
                description ?? null
            ]
        );

        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;

        let where = `WHERE 1=1`;
        const params = [];

        if (search) {
            where += ` AND (
                api_name LIKE ?
                OR api_label LIKE ?
                OR api_user_id LIKE ?
            )`;

            params.push(
                `%${search}%`,
                `%${search}%`,
                `%${search}%`
            );
        }

        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }

        const [rows] = await db.query(
            `SELECT
                id,
                api_name,
                api_label,
                api_user_id,
                api_key,
                base_url,
                endpoint,
                method,
                auth_type,
                header_name,
                status,
                description,
                created_at,
                updated_at
            FROM api_keys
            ${where}
            ORDER BY id DESC
            LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) AS total
             FROM api_keys
             ${where}`,
            params
        );

        const total = countResult[0]?.total || 0;

        return {
            data: rows,
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l)
        };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT
                id,
                api_name,
                api_label,
                api_user_id,
                api_key,
                base_url,
                endpoint,
                method,
                auth_type,
                header_name,
                status,
                description,
                created_at,
                updated_at
            FROM api_keys
            WHERE id = ?`,
            [id]
        );

        return rows[0];
    },

    update: async (id, updateData) => {
        const {
            api_name,
            api_label,
            api_user_id,
            api_key,
            base_url,
            endpoint,
            method,
            auth_type,
            header_name,
            status,
            description
        } = updateData;

        const sets = [];
        const values = [];

        if (api_name !== undefined) {
            sets.push('api_name = ?');
            values.push(api_name);
        }

        if (api_label !== undefined) {
            sets.push('api_label = ?');
            values.push(api_label);
        }

        if (api_user_id !== undefined) {
            sets.push('api_user_id = ?');
            values.push(api_user_id ?? null);
        }

        if (api_key !== undefined) {
            sets.push('api_key = ?');
            values.push(api_key);
        }

        if (base_url !== undefined) {
            sets.push('base_url = ?');
            values.push(base_url ?? null);
        }

        if (endpoint !== undefined) {
            sets.push('endpoint = ?');
            values.push(endpoint ?? null);
        }

        if (method !== undefined) {
            sets.push('method = ?');
            values.push(method);
        }

        if (auth_type !== undefined) {
            sets.push('auth_type = ?');
            values.push(auth_type ?? null);
        }

        if (header_name !== undefined) {
            sets.push('header_name = ?');
            values.push(header_name ?? null);
        }

        if (status !== undefined) {
            sets.push('status = ?');
            values.push(status);
        }

        if (description !== undefined) {
            sets.push('description = ?');
            values.push(description ?? null);
        }

        if (!sets.length) {
            return null;
        }

        values.push(id);

        const [result] = await db.execute(
            `UPDATE api_keys
             SET ${sets.join(', ')}
             WHERE id = ?`,
            values
        );

        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM api_keys WHERE id = ?`,
            [id]
        );

        return result;
    },

    updateStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE api_keys
             SET status = ?
             WHERE id = ?`,
            [status, id]
        );

        return result;
    }
};

export default ApiKey;