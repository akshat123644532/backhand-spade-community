const db = require('../config/db');

const Admin = {
    createTable: async () => {
        const query = `
            CREATE TABLE IF NOT EXISTS admins (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                contact_no VARCHAR(15),
                login_count INT DEFAULT 0,
                status ENUM('active', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        try {
            await db.query(query);
            console.log("➡️ Admins table ready.");
        } catch (err) {
            console.error("❌ Table error:", err.message);
        }
    },

    findByEmail: async (email) => {
        const query = `SELECT * FROM admins WHERE email = ?`;
        const [rows] = await db.query(query, [email]);
        return rows[0];
    },

    incrementLoginCount: async (id) => {
        const query = `
            UPDATE admins 
            SET login_count = login_count + 1 
            WHERE id = ? AND status = 'active'
        `;
        const [result] = await db.query(query, [id]);
        return result.affectedRows > 0;
    }
};

Admin.createTable();

module.exports = Admin;