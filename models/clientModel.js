import { db } from '../config/db.js';

const Client = {
    create: async (clientData) => {
        const { name, email, country, contact_no, admin_id, website_url } = clientData;

        const query = `
        INSERT INTO PaperWardb.clients 
        (name, email, country, contact_no, admin_id, website_url) 
        VALUES (?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.execute(query, [
            name || null,
            email || null,
            country || null,
            contact_no || null,
            admin_id || null,
            website_url || null
        ]);

        return result;
    },

    getAll: async () => {
        const query = `
        SELECT 
            c.id, c.name, c.email, c.country, c.contact_no, c.website_url, c.created_at,
            c.admin_id, a.name AS admin_name
        FROM PaperWardb.clients c
        LEFT JOIN PaperWardb.admins a ON c.admin_id = a.id
        `;

        const [rows] = await db.execute(query);
        return rows;
    },

    getById: async (id) => {
        const query = `
        SELECT 
            c.id, c.name, c.email, c.country, c.contact_no, c.website_url, c.created_at,
            c.admin_id, a.name AS admin_name
        FROM PaperWardb.clients c
        LEFT JOIN PaperWardb.admins a ON c.admin_id = a.id
        WHERE c.id = ?
        `;

        const [rows] = await db.execute(query, [id]);
        return rows[0];
    },

    findByEmail: async (email) => {
        const query = `SELECT id, email FROM PaperWardb.clients WHERE email = ?`;
        const [rows] = await db.execute(query, [email]);
        return rows[0];
    },

    update: async (id, updateData) => {
        const { name, country, contact_no, website_url } = updateData;

        const query = `
        UPDATE PaperWardb.clients 
        SET name = ?, country = ?, contact_no = ?, website_url = ?
        WHERE id = ?
        `;

        const [result] = await db.execute(query, [
            name || null,
            country || null,
            contact_no || null,
            website_url || null,
            id
        ]);

        return result;
    },

    delete: async (id) => {
        const query = `DELETE FROM PaperWardb.clients WHERE id = ?`;
        const [result] = await db.execute(query, [id]);
        return result;
    }
};

export default Client;