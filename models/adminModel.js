import { db } from '../config/db.js';

const Admin = {
findByEmail: async (email) => {
    const query = `
        SELECT
            id,
            name,
            email,
            password,
            permission_type,
            permissions,
            image_url,
            status,
            contact_no,
            token
        FROM admins
        WHERE email = ?
    `;

    const [rows] = await db.execute(query, [email]);
    return rows[0];
},

    create: async (adminData) => {
        const {
            name,
            email,
            password,
            permission_type,
            permissions,
            image_url,
            status,
            contact_no
        } = adminData;

        const query = `
            INSERT INTO admins
            (name, email, password, permission_type, permissions, image_url, status, contact_no)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.execute(query, [
            name,
            email,
            password,
            permission_type,
            permissions ?? null,
            image_url,
            status,
            contact_no
        ]);

        return result;
    },

    update: async (id, updateData) => {
        const {
            name,
            permission_type,
            permissions,
            image_url,
            status,
            updated_by
        } = updateData;

        const query = `
            UPDATE admins
            SET
                name = ?,
                permission_type = ?,
                permissions = ?,
                image_url = ?,
                status = ?,
                updated_by = ?
            WHERE id = ?
        `;

        const [result] = await db.execute(query, [
            name,
            permission_type,
            permissions ?? null,
            image_url,
            status,
            updated_by,
            id
        ]);

        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `DELETE FROM admins WHERE id = ?`,
            [id]
        );
        return result;
    },

    incrementLoginCount: async (id) => {
        const [result] = await db.execute(
            `UPDATE admins SET login_count = login_count + 1 WHERE id = ?`,
            [id]
        );

        return result;
    },

    updateToken: async (id, token) => {
        const [result] = await db.execute(
            `UPDATE admins SET token = ? WHERE id = ?`,
            [token, id]
        );

        return result;
    },

    updateOTP: async (email, otp, expiry) => {
        const [result] = await db.execute(
            `UPDATE admins SET otp = ?, otp_expiry = ? WHERE email = ?`,
            [otp, expiry, email]
        );

        return result;
    },

    findByOTP: async (email, otp) => {
        const [rows] = await db.execute(
            `SELECT id, email, otp, otp_expiry FROM admins WHERE email = ? AND otp = ?`,
            [email, otp]
        );

        return rows[0];
    },

    updatePassword: async (email, hashedPassword) => {
        const [result] = await db.execute(
            `UPDATE admins SET password = ?, otp = NULL, otp_expiry = NULL WHERE email = ?`,
            [hashedPassword, email]
        );

        return result;
    },

    getAll: async () => {
        const [rows] = await db.execute(`
            SELECT
                id,
                name,
                email,
                permission_type,
                permissions,
                image_url,
                status,
                contact_no,
                login_count
            FROM admins
        `);

        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `
            SELECT
                id,
                name,
                email,
                permission_type,
                permissions,
                image_url,
                status,
                contact_no,
                login_count
            FROM admins
            WHERE id = ?
            `,
            [id]
        );

        return rows[0];
    }
};

export default Admin;