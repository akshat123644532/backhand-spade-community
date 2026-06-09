import { db } from '../config/db.js';

const Partner = {

    generateCode: async () => {
        const [rows] = await db.execute(`SELECT code FROM partners ORDER BY id DESC LIMIT 1`);
        if (!rows.length) return 'P001';
        const num = parseInt(rows[0].code.replace('P', '')) + 1;
        return `P${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const { name, email, contact_no, country, contact_person, website_url, panel_size, complete, terminate, over_quota, quality_term, survey_close, about_partner, code, status } = data;
        const [result] = await db.execute(
            `INSERT INTO partners (code, name, email, contact_no, country, contact_person, website_url, panel_size, complete_val, terminate_val, over_quota_val, quality_term_val, survey_close_val, about_partner, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, name, email, contact_no || null, country || null, contact_person || null, website_url || null, panel_size || null, complete || null, terminate || null, over_quota || null, quality_term || null, survey_close || null, about_partner || null, status || 'active']
        );
        return result;
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', country = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND (name LIKE ? OR email LIKE ? OR code LIKE ? OR contact_person LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }
        if (country) {
            where += ` AND country = ?`;
            params.push(country);
        }

        const sql = `SELECT id, code, name, email, website_url, contact_no, country, status, created_at FROM partners ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        
        // db.query use kiya hai aur limit/offset ko cast kiya hai
        const [rows] = await db.query(sql, [...params, Number(l), Number(offset)]);
        
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM partners ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(`SELECT * FROM partners WHERE id = ? AND deleted_at IS NULL`, [id]);
        return rows[0] || null;
    },

    findByEmail: async (email) => {
        const [rows] = await db.execute(`SELECT id FROM partners WHERE email = ? AND deleted_at IS NULL`, [email]);
        return rows[0] || null;
    },

    findByCode: async (code) => {
        const [rows] = await db.execute(`SELECT id FROM partners WHERE code = ? AND deleted_at IS NULL`, [code]);
        return rows[0] || null;
    },

    update: async (id, data) => {
        const columnMap = { complete: 'complete_val', terminate: 'terminate_val', over_quota: 'over_quota_val', quality_term: 'quality_term_val', survey_close: 'survey_close_val' };
        const mappedData = {};
        Object.keys(data).forEach(k => { mappedData[columnMap[k] || k] = data[k]; });
        const fields = Object.keys(mappedData).map(k => `${k} = ?`).join(', ');
        const [result] = await db.execute(`UPDATE partners SET ${fields}, updated_at = NOW() WHERE id = ?`, [...Object.values(mappedData), id]);
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(`UPDATE partners SET deleted_at = NOW() WHERE id = ?`, [id]);
        return result;
    }
};

export default Partner;