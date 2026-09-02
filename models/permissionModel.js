import { db } from "../config/db.js";

const Permission = {

    set: async (adminId, permissions) => {
        const encoded = Buffer.from(JSON.stringify(permissions)).toString('base64');
        await db.execute(`UPDATE admins SET permissions = ? WHERE id = ?`, [encoded, adminId]);
    },

    getByAdmin: async (adminId) => {
        const [rows] = await db.execute(`SELECT permissions FROM admins WHERE id = ?`, [adminId]);
        if (!rows.length || !rows[0].permissions) return [];
        try {
            const decoded = Buffer.from(rows[0].permissions, 'base64').toString('utf8');
            const parsed = JSON.parse(decoded);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    // action: 'read' | 'write' | 'csv_download'
    check: async (adminId, moduleName, action = 'read') => {
        const list = await Permission.getByAdmin(adminId);
        const entry = list.find(p => p.module === moduleName);
        if (!entry) return false;

        if (action === 'write') return !!entry.write;
        if (action === 'csv_download') return !!entry.csv_download;
        return !!entry.read;
    }

};

export default Permission;

