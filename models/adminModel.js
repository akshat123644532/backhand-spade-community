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

    updateToken: async (id, token) => {
        const [result] = await db.execute(
            `UPDATE admins SET token = ? WHERE id = ?`,
            [token, id]
        );

        return result;
    },

    updatePassword: async (email, hashedPassword) => {
        // 'otp' aur 'otp_expiry' wale columns hata diye hain kyunki wo admins table mein nahi hain
        const [result] = await db.execute(
            `UPDATE admins SET password = ? WHERE email = ?`,
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
                contact_no
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
                contact_no
            FROM admins
            WHERE id = ?
            `,
            [id]
        );

        return rows[0];
    }
};

export default Admin;