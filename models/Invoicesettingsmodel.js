import { db } from '../config/db.js';

const InvoiceSettings = {

    get: async () => {
        const [rows] = await db.execute(
            `SELECT * FROM invoice_settings WHERE id = 1`
        );
        return rows[0] || null;
    },

    update: async (data) => {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(
            `UPDATE invoice_settings SET ${fields}, updated_at = NOW() WHERE id = 1`,
            [...Object.values(data)]
        );
        return result;
    }
};

export default InvoiceSettings;