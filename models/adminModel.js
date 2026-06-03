import db from '../config/db.js';

const Admin = {
    findByEmail: async (email) => {
        const query = `SELECT id, name, email, password, permission_type, image_url, status, contact_no, login_count, otp, otp_expiry FROM PaperWardb.admins WHERE email = ?`;
        const [rows] = await db.execute(query, [email || null]);
        return rows[0];
    },

    create: async (adminData) => {
        const { name, email, password, permission_type, image_url, status, contact_no } = adminData;
        const query = `INSERT INTO PaperWardb.admins (name, email, password, permission_type, image_url, status, contact_no) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(query, [
            name || null, 
            email || null, 
            password || null, 
            permission_type || 'read', 
            image_url || null, 
            status || 'active', 
            contact_no || null
        ]);
        return result;
    },

    update: async (id, updateData) => {
        const { name, permission_type, image_url, status, updated_by } = updateData;
        const query = `UPDATE PaperWardb.admins SET name = ?, permission_type = ?, image_url = ?, status = ?, updated_by = ? WHERE id = ?`;
        const [result] = await db.execute(query, [
            name || null, 
            permission_type || null, 
            image_url || null, 
            status || null, 
            updated_by || null, 
            id || null
        ]);
        return result;
    },

    delete: async (id) => {
        const query = `DELETE FROM PaperWardb.admins WHERE id = ?`;
        const [result] = await db.execute(query, [id || null]);
        return result;
    },

    incrementLoginCount: async (id) => {
        const query = `UPDATE PaperWardb.admins SET login_count = login_count + 1 WHERE id = ?`;
        const [result] = await db.execute(query, [id || null]);
        return result.affectedRows > 0;
    },

    updateOTP: async (email, otp, expiry) => {
        const query = `UPDATE PaperWardb.admins SET otp = ?, otp_expiry = ? WHERE email = ?`;
        const [result] = await db.execute(query, [otp, expiry, email]);
        return result;
    },

    findByOTP: async (email, otp) => {
        const query = `SELECT id, email, otp, otp_expiry FROM PaperWardb.admins WHERE email = ? AND otp = ?`;
        const [rows] = await db.execute(query, [email, otp]);
        return rows[0];
    },

    updatePassword: async (email, hashedPassword) => {
        const query = `UPDATE PaperWardb.admins SET password = ?, otp = NULL, otp_expiry = NULL WHERE email = ?`;
        const [result] = await db.execute(query, [hashedPassword, email]);
        return result;
    },

    getAll: async () => {
        const query = `SELECT id, name, email, permission_type, image_url, status, contact_no, login_count FROM PaperWardb.admins`;
        const [rows] = await db.execute(query);
        return rows;
    },

    getById: async (id) => {
        const query = `SELECT id, name, email, permission_type, image_url, status, contact_no, login_count FROM PaperWardb.admins WHERE id = ?`;
        const [rows] = await db.execute(query, [id || null]);
        return rows[0];
    }
};

export default Admin;