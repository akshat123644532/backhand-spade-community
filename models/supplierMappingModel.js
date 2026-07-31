import { db } from '../config/db.js';
import crypto from 'crypto';

const SupplierMapping = {

    generateMappingCode: async () => {
        const [rows] = await db.execute(`SELECT mapping_code FROM supplier_mapping ORDER BY id DESC LIMIT 1`);
        if (!rows.length || !rows[0].mapping_code) return 'SMAP001';
        const num = parseInt(rows[0].mapping_code.replace('SMAP', '')) + 1;
        return `SMAP${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const {
            partnerid, partner_code, projectid, projectUrlId, quota, CPI,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL, VenderURL,
            status, IsTest, action_by
        } = data;

        const mapping_code = await SupplierMapping.generateMappingCode();

        // Unique redirect link generate karo — dosurvey/<random-hash>?uid=[identifier]
        const uniqueHash = crypto.randomBytes(16).toString('hex');
        const baseUrl = (process.env.CLIENT_BASE_URL || 'https://spade-community.com').replace(/\/$/, '');
        const dynamic_url = `${baseUrl}/dosurvey/${uniqueHash}?uid=[identifier]`;

        const [result] = await db.execute(
            `INSERT INTO supplier_mapping
             (mapping_code, partnerid, partner_code, projectid, projectUrlId, quota, CPI,
              CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL, VenderURL,
              status, IsTest, action_by, dynamic_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                mapping_code, partnerid || null, partner_code || null, projectid || null, projectUrlId || null,
                quota || null, CPI || null,
                CompleteURL || null, TerminateURL || null, OverQuotaURL || null, QualityTermURL || null,
                SurveyCloseURL || null, VenderURL || null,
                status || 'active', IsTest || 0, action_by || null, dynamic_url
            ]
        );
        return { id: result.insertId, mapping_code, dynamic_url };
    },

    getAll: async ({ page = 1, limit = 10, search = '', status = '', projectid = '', partnerid = '' } = {}) => {
        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;
        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        if (search) {
            where += ` AND (mapping_code LIKE ? OR partner_code LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }
        if (projectid) {
            where += ` AND projectid = ?`;
            params.push(projectid);
        }
        if (partnerid) {
            where += ` AND partnerid = ?`;
            params.push(partnerid);
        }

        const [rows] = await db.query(
            `SELECT * FROM supplier_mapping ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(l), Number(offset)]
        );
        const [countResult] = await db.query(`SELECT COUNT(*) as total FROM supplier_mapping ${where}`, params);
        const total = countResult[0].total || 0;

        return { data: rows, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM supplier_mapping WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    getByProjectId: async (projectid) => {
        const [rows] = await db.execute(
            `SELECT * FROM supplier_mapping WHERE projectid = ? AND deleted_at IS NULL`, [projectid]
        );
        return rows;
    },

    getByPartnerId: async (partnerid) => {
        const [rows] = await db.execute(
            `SELECT * FROM supplier_mapping WHERE partnerid = ? AND deleted_at IS NULL`, [partnerid]
        );
        return rows;
    },

    getByDynamicHash: async (hash) => {
        const [rows] = await db.execute(
            `SELECT sm.*, pu.Live_Link, pu.Test_Link, pu.link_mode
             FROM supplier_mapping sm
             LEFT JOIN project_url_Info pu ON pu.id = sm.projectUrlId
             WHERE sm.dynamic_url LIKE ? AND sm.deleted_at IS NULL`,
            [`%/dosurvey/${hash}%`]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const safeData = { ...data };
        delete safeData.mapping_code;
        delete safeData.dynamic_url; // ye bhi kabhi update nahi hona chahiye

        const setClauses = Object.keys(safeData).map(k => `${k} = ?`).join(', ');
        if (!setClauses) return null;

        const [result] = await db.execute(
            `UPDATE supplier_mapping SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
            [...Object.values(safeData), id]
        );
        return result;
    },

    toggleStatus: async (id, status) => {
        const [result] = await db.execute(
            `UPDATE supplier_mapping SET status = ?, updated_at = NOW() WHERE id = ?`,
            [status, id]
        );
        return result;
    },

    delete: async (id) => {
        const [result] = await db.execute(
            `UPDATE supplier_mapping SET deleted_at = NOW() WHERE id = ?`, [id]
        );
        return result;
    }
};

export default SupplierMapping;