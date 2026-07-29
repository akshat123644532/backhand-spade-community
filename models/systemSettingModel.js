import { db } from '../config/db.js';

const SystemSetting = {
    get: async () => {
        const [rows] = await db.execute(`SELECT * FROM system_settings WHERE id = 1`);
        return rows[0] || null;
    },

    update: async (data) => {
        const allowedFields = [
            'application_name',
            'default_language',
            'date_format',
            'time_format',
            'theme_preference',
            'two_factor_auth',
            'login_alerts',
            'session_timeout_minutes',
            'remember_me_days'
        ];

        const updateData = {};
        for (const key of allowedFields) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }

        if (Object.keys(updateData).length === 0) return null;

        const fields = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
        await db.execute(
            `UPDATE system_settings SET ${fields} WHERE id = 1`,
            Object.values(updateData)
        );

        return SystemSetting.get();
    }
};

export default SystemSetting;