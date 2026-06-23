import { db } from '../config/db.js';

export const logActivity = async ({ admin_id, action, module, description, ip_address }) => {
    try {
        await db.execute(
            `INSERT INTO activity_logs (admin_id, action, module, description, ip_address) VALUES (?, ?, ?, ?, ?)`,
            [admin_id || null, action, module || null, description || null, ip_address || null]
        );
    } catch (error) {
        console.error("ACTIVITY LOG ERROR:", error.message);
    }
};