import { db } from '../config/db.js';

const ClientUser = {

    findByEmail: async (email) => {
        const [rows] = await db.execute(`SELECT * FROM client_users WHERE email = ? AND deleted_at IS NULL`, [email]);
        return rows[0] || null;
    },

    create: async (data) => {
        const { name, email, password, activation_token, activation_token_expires } = data;
        const [result] = await db.execute(
            `INSERT INTO client_users (name, email, password, activation_token, activation_token_expires)
             VALUES (?, ?, ?, ?, ?)`,
            [name, email, password, activation_token, activation_token_expires]
        );
        return result.insertId;
    },

    findByToken: async (token) => {
        const [rows] = await db.execute(
            `SELECT * FROM client_users WHERE activation_token = ? AND deleted_at IS NULL`,
            [token]
        );
        return rows[0] || null;
    },

    activateUser: async (id) => {
        await db.execute(
            `UPDATE client_users SET is_verified = 1, activation_token = NULL, activation_token_expires = NULL WHERE id = ?`,
            [id]
        );
    }
};

export default ClientUser;
