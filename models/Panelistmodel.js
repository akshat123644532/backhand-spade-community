import { db } from '../config/db.js';

const Panelist = {

    findByEmail: async (email) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        return rows[0] || null;
    },

    findByEmailInsensitive: async (email) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists
             WHERE LOWER(email) = LOWER(?)
             AND deleted_at IS NULL
             LIMIT 1`,
            [String(email || '').trim()]
        );
        return rows[0] || null;
    },

    findById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists
             WHERE id = ?
             AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    },

    create: async (data) => {
        const {
            name,
            email,
            phone,
            photo,
            password,
            activation_token,
            activation_token_expires,
            questionnaire_url
        } = data;

        const [result] = await db.execute(
            `INSERT INTO panelists
             (
                name,
                email,
                phone,
                photo,
                password,
                activation_token,
                activation_token_expires,
                questionnaire_url,
                balance_point
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                name,
                email,
                phone || null,
                photo || null,
                password,
                activation_token,
                activation_token_expires,
                questionnaire_url
            ]
        );

        return result.insertId;
    },

    findByToken: async (token) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists
             WHERE activation_token = ?
             AND deleted_at IS NULL`,
            [token]
        );

        return rows[0] || null;
    },

    activatePanelist: async (id) => {
        await db.execute(
            `UPDATE panelists
             SET
                is_verified = 1,
                activation_token = NULL,
                activation_token_expires = NULL
             WHERE id = ?`,
            [id]
        );
    },

    findByQuestionnaireUrl: async (questionnaire_url) => {
        const [rows] = await db.execute(
            `SELECT * FROM panelists
             WHERE questionnaire_url = ?
             AND deleted_at IS NULL`,
            [questionnaire_url]
        );

        return rows[0] || null;
    },

    setQuestionnaireUrl: async (id, questionnaire_url) => {
        await db.execute(
            `UPDATE panelists
             SET questionnaire_url = ?
             WHERE id = ?`,
            [questionnaire_url, id]
        );
    },

    markQuestionnaireCompleted: async (id, connection = db) => {
        await connection.execute(
            `UPDATE panelists
             SET questionnaire = 'yes',
                 updated_at = NOW()
             WHERE id = ?`,
            [id]
        );
    },

    addBalancePoints: async (id, points, connection = db) => {
        await connection.execute(
            `UPDATE panelists
             SET balance_point = balance_point + ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [points, id]
        );
    },

    // NOTE:
    // points param is kept for backward compatibility.
    // Reward points are credited only once during signup.
    completeQuestionnaireWithPoints: async (
        id,
        connection = db
    ) => {
        await connection.execute(
            `UPDATE panelists
             SET
                questionnaire = 'yes',
                is_verified = 1,
                updated_at = NOW()
             WHERE id = ?`,
            [id]
        );
    },

    // =====================================================
    // GET ALL PANELISTS
    // =====================================================
    getAll: async ({
        page = 1,
        limit = 10,
        search = '',
        status = '',
        is_verified = '',
        questionnaire = ''
    } = {}) => {

        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 10;
        const offset = (p - 1) * l;

        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        const cleanSearch = (search || '').trim();

        if (cleanSearch) {
            where += `
                AND (
                    LOWER(name) LIKE LOWER(?)
                    OR LOWER(email) LIKE LOWER(?)
                )
            `;

            params.push(
                `%${cleanSearch}%`,
                `%${cleanSearch}%`
            );
        }

        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }

        if (is_verified !== '') {
            where += ` AND is_verified = ?`;
            params.push(is_verified);
        }

        if (questionnaire) {
            where += ` AND questionnaire = ?`;
            params.push(questionnaire);
        }

        const [rows] = await db.query(
            `SELECT
                id,
                name,
                email,
                status,
                is_verified,
                questionnaire,
                balance_point,
                created_at
             FROM panelists
             ${where}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [
                ...params,
                Number(l),
                Number(offset)
            ]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) AS total
             FROM panelists
             ${where}`,
            params
        );

        return {
            data: rows,
            total: countResult[0].total || 0,
            page: p,
            limit: l,
            totalPages: Math.ceil(
                (countResult[0].total || 0) / l
            )
        };
    },

    // =====================================================
    // GET ALL PANELISTS FOR CSV EXPORT
    // =====================================================
    getAllForExport: async ({
        search = '',
        status = '',
        is_verified = '',
        questionnaire = ''
    } = {}) => {

        let where = `WHERE deleted_at IS NULL`;
        const params = [];

        const cleanSearch = (search || '').trim();

        // Search by name or email
        if (cleanSearch) {
            where += `
                AND (
                    LOWER(name) LIKE LOWER(?)
                    OR LOWER(email) LIKE LOWER(?)
                )
            `;

            params.push(
                `%${cleanSearch}%`,
                `%${cleanSearch}%`
            );
        }

        // Filter by status
        if (status) {
            where += ` AND status = ?`;
            params.push(status);
        }

        // Filter by verification
        if (is_verified !== '') {
            where += ` AND is_verified = ?`;
            params.push(is_verified);
        }

        // Filter by questionnaire
        if (questionnaire) {
            where += ` AND questionnaire = ?`;
            params.push(questionnaire);
        }

        const [rows] = await db.query(
            `SELECT
                id,
                name,
                email,
                created_at,
                status
             FROM panelists
             ${where}
             ORDER BY created_at DESC`,
            params
        );

        return rows;
    },

    // =====================================================
    // FIND PANELISTS BY IDS
    // =====================================================
    findByIds: async (ids) => {

        if (!ids || ids.length === 0) {
            return [];
        }

        const placeholders = ids
            .map(() => '?')
            .join(', ');

        const [rows] = await db.execute(
            `SELECT *
             FROM panelists
             WHERE id IN (${placeholders})
             AND deleted_at IS NULL`,
            ids
        );

        return rows;
    },

    // =====================================================
    // UPDATE PANELIST
    // =====================================================
    update: async (id, data) => {

        const fields = Object.keys(data)
            .map(k => `${k} = ?`)
            .join(', ');

        const [result] = await db.execute(
            `UPDATE panelists
             SET ${fields},
                 updated_at = NOW()
             WHERE id = ?`,
            [
                ...Object.values(data),
                id
            ]
        );

        return result;
    },

    // =====================================================
    // DELETE PANELIST
    // =====================================================
    delete: async (id) => {

        const [result] = await db.execute(
            `UPDATE panelists
             SET deleted_at = NOW()
             WHERE id = ?`,
            [id]
        );

        return result;
    },

    // =====================================================
    // TOGGLE STATUS
    // =====================================================
    toggleStatus: async (id, status) => {

        const [result] = await db.execute(
            `UPDATE panelists
             SET status = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [status, id]
        );

        return result;
    },

    // =====================================================
    // PANELIST COUNT
    // =====================================================
    getAllPanelistsCount: async () => {

        const [result] = await db.query(
            `SELECT COUNT(*) AS total
             FROM panelists
             WHERE deleted_at IS NULL`
        );

        return result[0].total || 0;
    },

    // =====================================================
    // ACTIVE PANELIST EMAILS
    // =====================================================
    getActiveEmails: async (limit, excludeEmails = []) => {

        if (!limit || limit < 1) {
            return [];
        }

        const excluded = [
            ...new Set(
                (excludeEmails || [])
                    .map((e) =>
                        String(e || '')
                            .trim()
                            .toLowerCase()
                    )
                    .filter(Boolean)
            )
        ];

        let sql = `
            SELECT email
            FROM panelists
            WHERE deleted_at IS NULL
              AND status = 'active'
              AND email IS NOT NULL
              AND email != ''
        `;

        const params = [];

        if (excluded.length) {

            const placeholders = excluded
                .map(() => '?')
                .join(', ');

            sql += `
                AND LOWER(email)
                NOT IN (${placeholders})
            `;

            params.push(...excluded);
        }

        sql += ` ORDER BY id ASC LIMIT ?`;

        params.push(Number(limit));

        const [rows] = await db.query(
            sql,
            params
        );

        return rows
            .map((r) => r.email)
            .filter(Boolean);
    },

    // =====================================================
    // COUNT ACTIVE PANELISTS
    // =====================================================
    countActive: async (excludeEmails = []) => {

        const excluded = [
            ...new Set(
                (excludeEmails || [])
                    .map((e) =>
                        String(e || '')
                            .trim()
                            .toLowerCase()
                    )
                    .filter(Boolean)
            )
        ];

        let sql = `
            SELECT COUNT(*) AS total
            FROM panelists
            WHERE deleted_at IS NULL
              AND status = 'active'
              AND email IS NOT NULL
              AND email != ''
        `;

        const params = [];

        if (excluded.length) {

            const placeholders = excluded
                .map(() => '?')
                .join(', ');

            sql += `
                AND LOWER(email)
                NOT IN (${placeholders})
            `;

            params.push(...excluded);
        }

        const [rows] = await db.query(
            sql,
            params
        );

        return Number(
            rows[0]?.total || 0
        );
    },

    getSignupDetailsById: async (id) => {
        const [rows] = await db.query(
            `SELECT
                p.id,
                p.name,
                p.email,
                p.phone,
                p.balance_point,
                p.status,
                p.created_at,
                psd.id AS signup_detail_id,
                psd.panelist_id,
                psd.ip_address,
                psd.user_agent,
                psd.browser,
                psd.browser_version,
                psd.os,
                psd.os_version,
                psd.device_type,
                psd.device_name,
                psd.fraud_score,
                psd.fraud_risk,
                psd.vpn,
                psd.tor,
                psd.proxy,
                psd.datacenter,
                psd.country,
                psd.country_code,
                psd.state,
                psd.city,
                psd.postal_code,
                psd.latitude,
                psd.longitude,
                psd.asn,
                psd.isp_name,
                psd.organization_name,
                psd.created_at AS signup_created_at

            FROM panelists p
            LEFT JOIN panelist_signup_details psd
                ON psd.panelist_id = p.id
            WHERE p.id = ?
            AND p.deleted_at IS NULL
            ORDER BY psd.created_at DESC`,
            [id]
        );
        return rows[0] || null;
    },
     getLoginDetailsById: async (id, page = 1, limit = 20) => {
        const offset = (page - 1) * limit;
    
        const [panelistRows] = await db.execute(
            `
            SELECT
                p.id,
                p.name,
                p.email,
                p.phone,
                p.balance_point,
                p.status,
                p.created_at,
    
                pld.id AS login_detail_id,
                pld.panelist_id,
                pld.ip_address,
                pld.user_agent,
                pld.browser,
                pld.browser_version,
                pld.os,
                pld.os_version,
                pld.device_type,
                pld.device_name,
                pld.fraud_score,
                pld.fraud_risk,
                pld.vpn,
                pld.tor,
                pld.proxy,
                pld.datacenter,
                pld.country,
                pld.country_code,
                pld.state,
                pld.city,
                pld.postal_code,
                pld.latitude,
                pld.longitude,
                pld.asn,
                pld.isp_name,
                pld.organization_name,
                pld.created_at AS login_created_at
    
            FROM panelists p
            LEFT JOIN panelist_login_details pld
                ON pld.panelist_id = p.id
    
            WHERE p.id = ?
              AND p.deleted_at IS NULL
    
            ORDER BY pld.created_at DESC
    
            LIMIT ? OFFSET ?
            `,
            [id, limit, offset]
        );
    
        if (!panelistRows.length) {
            return null;
        }
    
        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM panelist_login_details
            WHERE panelist_id = ?
            `,
            [id]
        );
    
        const total = countRows[0].total;
    
        const panelist = {
            id: panelistRows[0].id,
            name: panelistRows[0].name,
            email: panelistRows[0].email,
            phone: panelistRows[0].phone,
            balance_point: panelistRows[0].balance_point,
            status: panelistRows[0].status,
            created_at: panelistRows[0].created_at,
    
            login_details: panelistRows.map(row => ({
                id: row.login_detail_id,
                panelist_id: row.panelist_id,
                ip_address: row.ip_address,
                user_agent: row.user_agent,
                browser: row.browser,
                browser_version: row.browser_version,
                os: row.os,
                os_version: row.os_version,
                device_type: row.device_type,
                device_name: row.device_name,
                fraud_score: row.fraud_score,
                fraud_risk: row.fraud_risk,
                vpn: row.vpn,
                tor: row.tor,
                proxy: row.proxy,
                datacenter: row.datacenter,
                country: row.country,
                country_code: row.country_code,
                state: row.state,
                city: row.city,
                postal_code: row.postal_code,
                latitude: row.latitude,
                longitude: row.longitude,
                asn: row.asn,
                isp_name: row.isp_name,
                organization_name: row.organization_name,
                created_at: row.login_created_at
            })),
    
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    
        return panelist;
    }
};

export default Panelist;