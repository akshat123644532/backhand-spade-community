import { db } from '../config/db.js';

const Partner = {

    generateCode: async () => {
        const [rows] = await db.execute(
            `SELECT code FROM partners ORDER BY id DESC LIMIT 1`
        );
        if (!rows.length) return 'P001';
        const num = parseInt(rows[0].code.replace('P', '')) + 1;
        return `P${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const {
            name, email, contact_no, country, contact_person,
            website_url, panel_size, complete, terminate,
            over_quota, quality_term, survey_close, about_partner,
            code, status
        } = data;

        const [result] = await db.execute(
            `INSERT INTO partners 
            (code, name, email, contact_no, country, contact_person, website_url, 
             panel_size, complete_val, terminate_val, over_quota_val, quality_term_val, 
             survey_close_val, about_partner, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                code, name, email,
                contact_no || null, country || null,
                contact_person || null, website_url || null,
                panel_size || null,
                complete || null, terminate || null,
                over_quota || null, quality_term || null,
                survey_close || null, about_partner || null,
                status || 'active'
            ]
        );
        return result;
    },

    getAll: async () => {
        const [rows] = await db.execute(
            `SELECT id, code, name, email, website_url, contact_no, country, status, created_at 
             FROM partners 
             WHERE deleted_at IS NULL
             ORDER BY created_at DESC`
        );
        return rows;
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM partners WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT id FROM partners WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        return rows[0] || null;
    },

    findByCode: async (code) => {
        const [rows] = await db.execute(
            `SELECT id FROM partners WHERE code = ? AND deleted_at IS NULL`,
            [code]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const columnMap = {
            complete:     'complete_val',
            terminate:    'terminate_val',
            over_quota:   'over_quota_val',
            quality_term: 'quality_term_val',
            survey_close: 'survey_close_val',
        };

        const mappedData = {};
        Object.keys(data).forEach(k => {
            mappedData[columnMap[k] || k] = data[k];
        });

        const fields = Object.keys(mappedData).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(mappedData), id];

        const [result] = await db.execute(
            `UPDATE partners SET ${fields}, updated_at = NOW() WHERE id = ?`,
            values
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE partners SET deleted_at = NOW() WHERE id = ?`,
            [id]
        );
        return result;
    }
};

export default Partner;