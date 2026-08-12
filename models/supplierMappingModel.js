import { db } from '../config/db.js';
import { encryptId, decryptId } from '../utils/Encryptionhelper.js';
import ProjectMultipleUrl from './projectMultipleUrlModel.js';

const SupplierMapping = {

    generateMappingCode: async (conn = db) => {
        const [rows] = await conn.execute(`SELECT mapping_code FROM supplier_mapping ORDER BY id DESC LIMIT 1`);
        if (!rows.length || !rows[0].mapping_code) return 'SMAP001';
        const num = parseInt(rows[0].mapping_code.replace('SMAP', '')) + 1;
        return `SMAP${String(num).padStart(3, '0')}`;
    },

    create: async (data) => {
        const {
            partnerid, partner_code, partner_name, projectid, projectUrlId, quota, CPI,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
            status, IsTest, action_by, isMultiLink
        } = data;
        // Note: incoming VenderURL (if any) is ignored — it's auto-generated below

        const assignCount = parseInt(quota, 10) || 0;
        const connection = await db.getConnection();
        let started = false;

        try {
            await connection.beginTransaction();
            started = true;

            // Multi Link: assign partner_id to `quota` unassigned project_mutiple_Url rows
            if (isMultiLink && assignCount > 0) {
                const stats = await ProjectMultipleUrl.getStatsByProjectId(projectid, connection);
                if (assignCount > stats.remainingMultiLinkCount) {
                    const err = new Error(
                        `quota (${assignCount}) cannot be greater than remaining multi-link count (${stats.remainingMultiLinkCount}). Total multi-links: ${stats.totalMultiLinkCount}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }
            }

            const mapping_code = await SupplierMapping.generateMappingCode(connection);

            const [projectRows] = await connection.execute(
                `SELECT startDate, endDate FROM project_Info WHERE id = ?`,
                [projectid]
            );
            const startDate = projectRows[0]?.startDate || null;
            const endDate = projectRows[0]?.endDate || null;

            const [urlRows] = await connection.execute(
                `SELECT Test_Link FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`,
                [projectUrlId]
            );
            const testLink = (urlRows[0]?.Test_Link || '').replace(/\/$/, '');
            const VenderURL = testLink || null;

            const tokenPayload = {
                partnerid,
                partner_code,
                projectUrlId,
                projectid,
                startDate,
                endDate
            };
            const token = encryptId(JSON.stringify(tokenPayload));
            const baseUrl = (process.env.CLIENT_BASE_URL || 'https://spade-community.com').replace(/\/$/, '');
            const dynamic_url = `${baseUrl}/dosurvey/${token}?uid=[identifier]`;

            const [result] = await connection.execute(
                `INSERT INTO supplier_mapping
                 (mapping_code, partnerid, partner_code, projectid, projectUrlId, quota, CPI,
                  CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL, VenderURL,
                  status, IsTest, action_by, dynamic_url, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    mapping_code, partnerid || null, partner_code || null, projectid || null, projectUrlId || null,
                    quota || null, CPI || null,
                    CompleteURL || null, TerminateURL || null, OverQuotaURL || null, QualityTermURL || null,
                    SurveyCloseURL || null, VenderURL,
                    status || 'active', IsTest || 0, action_by || null, dynamic_url
                ]
            );

            const mappingId = result.insertId;
            let assignedMultiUrlIds = [];

            if (isMultiLink && assignCount > 0) {
                assignedMultiUrlIds = await ProjectMultipleUrl.getUnassignedIds(projectid, assignCount, connection);
                if (assignedMultiUrlIds.length < assignCount) {
                    const err = new Error(
                        `Not enough unassigned multi-links. Requested ${assignCount}, available ${assignedMultiUrlIds.length}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }

                await ProjectMultipleUrl.assignPartnerToRows({
                    ids: assignedMultiUrlIds,
                    partner_id: partnerid,
                    Vender_UserName: partner_name || partner_code || null
                }, connection);
            }

            await connection.commit();

            return {
                id: mappingId,
                mapping_code,
                dynamic_url,
                VenderURL,
                assignedMultiUrlIds,
                linksAssigned: assignedMultiUrlIds.length
            };
        } catch (error) {
            if (started) await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    },

    // 👇 NAYA: Single Link projects ke liye — is project ka active VenderURL nikalo email bhejne ke liye
    getVenderUrlByProjectId: async (project_id, conn = db) => {
        const [rows] = await conn.execute(
            `SELECT VenderURL FROM supplier_mapping 
             WHERE projectid = ? AND status = 'active' AND deleted_at IS NULL 
             ORDER BY id DESC LIMIT 1`,
            [project_id]
        );
        return rows[0]?.VenderURL || null;
    },

    toggleIsTest: async (id, IsTest) => {
        const [result] = await db.execute(
            `UPDATE supplier_mapping SET IsTest = ?, updated_at = NOW() WHERE id = ?`,
            [IsTest, id]
        );
        return result;
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

    getQuotaSumByProjectId: async (projectid) => {
        const [rows] = await db.execute(
            `SELECT COALESCE(SUM(quota), 0) AS samplesAdded
             FROM supplier_mapping
             WHERE projectid = ? AND deleted_at IS NULL`,
            [projectid]
        );
        return Number(rows[0]?.samplesAdded || 0);
    },

    getByPartnerId: async (partnerid) => {
        const [rows] = await db.execute(
            `SELECT * FROM supplier_mapping WHERE partnerid = ? AND deleted_at IS NULL`, [partnerid]
        );
        return rows;
    },

    getByDynamicHash: async (token) => {
        let tokenData;
        try {
            tokenData = JSON.parse(decryptId(token));
        } catch {
            const [rows] = await db.execute(
                `SELECT sm.*, pu.Live_Link, pu.Test_Link, pu.link_mode
                 FROM supplier_mapping sm
                 LEFT JOIN project_url_Info pu ON pu.id = sm.projectUrlId
                 WHERE sm.dynamic_url LIKE ? AND sm.deleted_at IS NULL`,
                [`%/dosurvey/${token}%`]
            );
            return rows[0] || null;
        }

        const [rows] = await db.execute(
            `SELECT sm.*, pu.Live_Link, pu.Test_Link, pu.link_mode
             FROM supplier_mapping sm
             LEFT JOIN project_url_Info pu ON pu.id = sm.projectUrlId
             WHERE sm.partnerid = ? AND sm.projectid = ? AND sm.projectUrlId = ?
               AND sm.deleted_at IS NULL
             ORDER BY sm.id DESC LIMIT 1`,
            [tokenData.partnerid, tokenData.projectid, tokenData.projectUrlId]
        );

        if (!rows[0]) return null;
        return { ...rows[0], tokenData };
    },

    update: async (id, data, { partner_name, isMultiLink } = {}) => {
        const connection = await db.getConnection();
        let started = false;

        try {
            await connection.beginTransaction();
            started = true;

            const [mappingRows] = await connection.execute(
                `SELECT * FROM supplier_mapping WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );
            const mapping = mappingRows[0];
            if (!mapping) {
                const err = new Error('Supplier mapping not found!');
                err.statusCode = 404;
                throw err;
            }

            const safeData = { ...data };
            delete safeData.mapping_code;
            delete safeData.dynamic_url;
            delete safeData.linksToAssign;
            delete safeData.partner_name;
            delete safeData.isMultiLink;

            const nextPartnerId = safeData.partnerid !== undefined ? safeData.partnerid : mapping.partnerid;
            const nextProjectId = safeData.projectid !== undefined ? safeData.projectid : mapping.projectid;
            const nextQuota = safeData.quota !== undefined
                ? (parseInt(safeData.quota, 10) || 0)
                : (parseInt(mapping.quota, 10) || 0);

            const partnerChanged = Number(nextPartnerId) !== Number(mapping.partnerid);
            const projectChanged = Number(nextProjectId) !== Number(mapping.projectid);
            const quotaChanged = safeData.quota !== undefined
                && nextQuota !== (parseInt(mapping.quota, 10) || 0);

            let assignedMultiUrlIds = [];

            if (isMultiLink && (partnerChanged || projectChanged || quotaChanged)) {
                // Free rows currently held by the old partner on the old project
                const currentlyAssigned = await ProjectMultipleUrl.getAssignedIdsByPartner(
                    mapping.projectid, mapping.partnerid, connection
                );
                if (currentlyAssigned.length) {
                    await ProjectMultipleUrl.unassignPartnerFromRows(currentlyAssigned, connection);
                }

                if (nextQuota < 1) {
                    const err = new Error('quota must be a positive number for Multi Link projects!');
                    err.statusCode = 400;
                    throw err;
                }

                const stats = await ProjectMultipleUrl.getStatsByProjectId(nextProjectId, connection);
                if (nextQuota > stats.remainingMultiLinkCount) {
                    const err = new Error(
                        `quota (${nextQuota}) cannot be greater than remaining multi-link count (${stats.remainingMultiLinkCount}). Total multi-links: ${stats.totalMultiLinkCount}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }

                assignedMultiUrlIds = await ProjectMultipleUrl.getUnassignedIds(nextProjectId, nextQuota, connection);
                if (assignedMultiUrlIds.length < nextQuota) {
                    const err = new Error(
                        `Not enough unassigned multi-links. Requested ${nextQuota}, available ${assignedMultiUrlIds.length}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }

                await ProjectMultipleUrl.assignPartnerToRows({
                    ids: assignedMultiUrlIds,
                    partner_id: nextPartnerId,
                    Vender_UserName: partner_name || safeData.partner_code || mapping.partner_code || null
                }, connection);

                safeData.quota = nextQuota;
            }

            const setClauses = Object.keys(safeData).map(k => `${k} = ?`).join(', ');
            if (setClauses) {
                await connection.execute(
                    `UPDATE supplier_mapping SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
                    [...Object.values(safeData), id]
                );
            }

            await connection.commit();
            return {
                linksAssigned: assignedMultiUrlIds.length,
                assignedMultiUrlIds: assignedMultiUrlIds.toString()
            };
        } catch (error) {
            if (started) await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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