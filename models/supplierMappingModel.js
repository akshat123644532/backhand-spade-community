import { db } from '../config/db.js';
import { encodeSurveyToken, decodeSurveyToken } from '../utils/Encryptionhelper.js';
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

            let assignedMultiUrlIds = [];
            let dynamic_url = null;
            let VenderURL = null;

            if (assignCount < 1) {
                const err = new Error('quota is required and must be a positive number!');
                err.statusCode = 400;
                throw err;
            }

            await SupplierMapping.assertQuotaWithinSampleSize({
                projectUrlId,
                quota: assignCount,
                conn: connection
            });

            if (isMultiLink) {
                // Multi Link: assign partner_id to `quota` unassigned rows for this project_url_id
                const stats = await ProjectMultipleUrl.getStatsByProjectId(projectid, projectUrlId, connection);
                if (assignCount > stats.remainingMultiLinkCount) {
                    const err = new Error(
                        `quota (${assignCount}) cannot be greater than remaining multi-link count (${stats.remainingMultiLinkCount}). Total multi-links: ${stats.totalMultiLinkCount}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }

                assignedMultiUrlIds = await ProjectMultipleUrl.getUnassignedIds(
                    projectid, assignCount, connection, projectUrlId
                );
                if (assignedMultiUrlIds.length < assignCount) {
                    const err = new Error(
                        `Not enough unassigned multi-links. Requested ${assignCount}, available ${assignedMultiUrlIds.length}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }

                await ProjectMultipleUrl.assignPartnerToRows({
                    ids: assignedMultiUrlIds,
                    partner_id: partnerid
                }, connection);

                // Use first assigned row's VenderURL for both dynamic_url and VenderURL
                const firstRow = await ProjectMultipleUrl.getById(assignedMultiUrlIds[0], connection);
                dynamic_url = firstRow?.VenderURL || null;
                VenderURL = dynamic_url;
            } else {
                // SingleLink: one dosurvey URL (?pid=&uid=XXXXXX) → VenderURL + dynamic_url
                const [urlRows] = await connection.execute(
                    `SELECT project_url_code FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`,
                    [projectUrlId]
                );
                const project_url_code = urlRows[0]?.project_url_code || null;
                if (!project_url_code) {
                    const err = new Error('project_url_code missing for this Project URL!');
                    err.statusCode = 400;
                    throw err;
                }

                const token = encodeSurveyToken({
                    partnerid,
                    projectUrlId,
                    projectid
                });
                const baseUrl = (process.env.CLIENT_BASE_URL || 'https://spade-community.com').replace(/\/$/, '');
                const params = new URLSearchParams();
                params.set('pid', String(project_url_code));
                params.set('uid', 'XXXXXX');
                VenderURL = `${baseUrl}/dosurvey/${token}?${params.toString()}`;
                dynamic_url = VenderURL;
            }

            const mapping_code = await SupplierMapping.generateMappingCode(connection);

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

    getByProjectAndUrl: async (projectid, projectUrlId) => {
        const [rows] = await db.execute(
            `SELECT * FROM supplier_mapping
             WHERE projectid = ?
               AND projectUrlId = ?
               AND deleted_at IS NULL
             ORDER BY id DESC
             LIMIT 1`,
            [projectid, projectUrlId]
        );
        return rows[0] || null;
    },

    getByPartnerProjectUrl: async (partnerid, projectid, projectUrlId) => {
        const [rows] = await db.execute(
            `SELECT * FROM supplier_mapping
             WHERE partnerid = ?
               AND projectid = ?
               AND projectUrlId = ?
               AND deleted_at IS NULL
             ORDER BY id DESC
             LIMIT 1`,
            [partnerid, projectid, projectUrlId]
        );
        return rows[0] || null;
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

    getQuotaSumByProjectUrlId: async (projectUrlId, { excludeId = null, conn = db } = {}) => {
        let sql = `SELECT COALESCE(SUM(quota), 0) AS quotasAdded
                   FROM supplier_mapping
                   WHERE projectUrlId = ? AND deleted_at IS NULL`;
        const params = [projectUrlId];
        if (excludeId != null && excludeId !== '') {
            sql += ` AND id != ?`;
            params.push(excludeId);
        }
        const [rows] = await conn.execute(sql, params);
        return Number(rows[0]?.quotasAdded || 0);
    },

    getQuotaStatsByProjectUrlId: async (projectUrlId, { excludeId = null, conn = db } = {}) => {
        const [urlRows] = await conn.execute(
            `SELECT SampleSize FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`,
            [projectUrlId]
        );
        const sampleSize = Number(urlRows[0]?.SampleSize || 0);
        const quotasAdded = await SupplierMapping.getQuotaSumByProjectUrlId(projectUrlId, { excludeId, conn });
        const remainingQuota = Math.max(sampleSize - quotasAdded, 0);
        return { sampleSize, quotasAdded, remainingQuota };
    },

    assertQuotaWithinSampleSize: async ({ projectUrlId, quota, excludeMappingId = null, conn = db }) => {
        const { sampleSize, quotasAdded, remainingQuota } =
            await SupplierMapping.getQuotaStatsByProjectUrlId(projectUrlId, {
                excludeId: excludeMappingId,
                conn
            });
        if (quota > sampleSize) {
            const err = new Error(
                `Quota cannot be more than the sample size which is ${sampleSize}.`
            );
            err.statusCode = 400;
            throw err;
        }
        if (quota > remainingQuota) {
            const err = new Error(
                `Quota cannot be more than the remaining sample size (${remainingQuota}). Sample size is ${sampleSize} and quotas already added are ${quotasAdded}.`
            );
            err.statusCode = 400;
            throw err;
        }
        return { sampleSize, quotasAdded, remainingQuota };
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
            tokenData = decodeSurveyToken(token);
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
             WHERE sm.partnerid <=> ? AND sm.projectid = ? AND sm.projectUrlId = ?
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
            delete safeData.VenderURL;
            delete safeData.linksToAssign;
            delete safeData.partner_name;
            delete safeData.isMultiLink;

            const nextPartnerId = safeData.partnerid !== undefined ? safeData.partnerid : mapping.partnerid;
            const nextProjectId = safeData.projectid !== undefined ? safeData.projectid : mapping.projectid;
            const nextProjectUrlId = safeData.projectUrlId !== undefined
                ? safeData.projectUrlId
                : mapping.projectUrlId;
            const nextQuota = safeData.quota !== undefined
                ? (parseInt(safeData.quota, 10) || 0)
                : (parseInt(mapping.quota, 10) || 0);

            const partnerChanged = Number(nextPartnerId) !== Number(mapping.partnerid);
            const projectChanged = Number(nextProjectId) !== Number(mapping.projectid);
            const projectUrlChanged = Number(nextProjectUrlId) !== Number(mapping.projectUrlId);
            const quotaChanged = safeData.quota !== undefined
                && nextQuota !== (parseInt(mapping.quota, 10) || 0);

            let assignedMultiUrlIds = [];
            const quotaInPayload = Object.prototype.hasOwnProperty.call(safeData, 'quota');
            const quotaRelevant = partnerChanged || projectChanged || projectUrlChanged || quotaChanged || quotaInPayload;

            if (quotaInPayload || projectChanged || projectUrlChanged || quotaChanged) {
                if (nextQuota < 1) {
                    const err = new Error('quota must be a positive number!');
                    err.statusCode = 400;
                    throw err;
                }

                await SupplierMapping.assertQuotaWithinSampleSize({
                    projectUrlId: nextProjectUrlId,
                    quota: nextQuota,
                    excludeMappingId: id,
                    conn: connection
                });
                safeData.quota = nextQuota;
            }

            if (isMultiLink && quotaRelevant) {
                // Free rows currently held by the old partner on the old project URL
                const currentlyAssigned = await ProjectMultipleUrl.getAssignedIdsByPartner(
                    mapping.projectid, mapping.partnerid, connection, mapping.projectUrlId
                );
                if (currentlyAssigned.length) {
                    await ProjectMultipleUrl.unassignPartnerFromRows(currentlyAssigned, connection);
                }

                const stats = await ProjectMultipleUrl.getStatsByProjectId(
                    nextProjectId, nextProjectUrlId, connection
                );
                if (nextQuota > stats.remainingMultiLinkCount) {
                    const err = new Error(
                        `quota (${nextQuota}) cannot be greater than remaining multi-link count (${stats.remainingMultiLinkCount}). Total multi-links: ${stats.totalMultiLinkCount}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }

                assignedMultiUrlIds = await ProjectMultipleUrl.getUnassignedIds(
                    nextProjectId, nextQuota, connection, nextProjectUrlId
                );
                if (assignedMultiUrlIds.length < nextQuota) {
                    const err = new Error(
                        `Not enough unassigned multi-links. Requested ${nextQuota}, available ${assignedMultiUrlIds.length}.`
                    );
                    err.statusCode = 400;
                    throw err;
                }

                await ProjectMultipleUrl.assignPartnerToRows({
                    ids: assignedMultiUrlIds,
                    partner_id: nextPartnerId
                }, connection);

                const firstRow = await ProjectMultipleUrl.getById(assignedMultiUrlIds[0], connection);
                const sharedUrl = firstRow?.VenderURL || null;
                safeData.dynamic_url = sharedUrl;
                safeData.VenderURL = sharedUrl;
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