import { db } from '../config/db.js';
const ContactUs = {

    create: async ({
        full_name,
        email,
        subject,
        message
    }) => {

        const [result] = await db.execute(
            `INSERT INTO contact_us
            (
                full_name,
                email,
                subject,
                message
            )
            VALUES (?, ?, ?, ?)`,
            [
                full_name,
                email,
                subject,
                message
            ]
        );

        return result.insertId;
    },

    getById: async (id) => {

        const [rows] = await db.execute(
            `SELECT
                id,
                full_name,
                email,
                subject,
                message,
                created_at,
                updated_at
             FROM contact_us
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        return rows[0] || null;
    }

};

export default ContactUs;