import { db } from '../config/db.js';
import crypto from 'crypto';

const ALLOWED_UPDATE_FIELDS = new Set([
    'description', 'LOI', 'IR', 'country', 'CPI', 'SampleSize',
    'Start_Date', 'End_Date', 'Status', 'Live_Link', 'Test_Link',
    'GeoLocation', 'UrlProtection', 'UniqueIP', 'PreScreen', 'FraudDetection',
    'Language', 'PreScreenid', 'PreScreenName',
    'TerminationPoint', 'CompletionPoint', 'ValidatePoint',
    'CompleteURL', 'TerminateURL', 'OverQuotaURL', 'QualityTermURL', 'SurveyCloseURL',
    'link_mode', 'Project_Link_Type', 'updated_by'
]);

/** Canonical values: MultiLink | SingleLink */
const normalizeProjectLinkType = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const n = String(val).trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (n === 'multilink') return 'MultiLink';
    if (n === 'singlelink') return 'SingleLink';
    return null;
};

const FLAG_FIELDS = ['GeoLocation', 'UrlProtection', 'UniqueIP', 'FraudDetection', 'PreScreen'];

/** Coerce checkbox / flag values; explicit 0 / false / "0" stay 0 */
const toIntFlag = (val, fallback = 0) => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'number') {
        if (!Number.isFinite(val)) return fallback;
        return val === 0 ? 0 : 1;
    }

    const raw = String(val).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(raw)) return 1;
    if (['0', 'false', 'no', 'off'].includes(raw)) return 0;

    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return n === 0 ? 0 : 1;
};

const toNullable = (val) => {
    if (val === undefined || val === null || val === '') return null;
    return val;
};

const pickFirstDefined = (obj, keys) => {
    for (const key of keys) {
        if (obj[key] !== undefined) return obj[key];
    }
    return undefined;
};

/** Normalize frontend aliases → DB column names */
const normalizeUrlPayload = (data = {}) => {
    const payload = { ...data };

    const flagAliasMap = {
        GeoLocation: ['GeoLocation', 'geoLocation', 'geo_location', 'Geolocation'],
        UrlProtection: ['UrlProtection', 'urlProtection', 'url_protection', 'URLProtection'],
        UniqueIP: ['UniqueIP', 'uniqueIP', 'unique_ip', 'UniqueIp'],
        FraudDetection: ['FraudDetection', 'fraudDetection', 'fraud_detection'],
        PreScreen: ['PreScreen', 'prescreen', 'pre_screen', 'Pre_Screen']
    };

    for (const [canonical, aliases] of Object.entries(flagAliasMap)) {
        const value = pickFirstDefined(payload, aliases);
        if (value !== undefined) payload[canonical] = value;
        for (const alias of aliases) {
            if (alias !== canonical) delete payload[alias];
        }
    }

    const preScreenId = pickFirstDefined(payload, [
        'PreScreenid', 'PreScreenId', 'prescreenid', 'prescreen_id',
        'pre_screen_id', 'PreScreenID'
    ]);
    if (preScreenId !== undefined) payload.PreScreenid = preScreenId;
    for (const alias of ['PreScreenId', 'prescreenid', 'prescreen_id', 'pre_screen_id', 'PreScreenID']) {
        delete payload[alias];
    }

    const preScreenName = pickFirstDefined(payload, [
        'PreScreenName', 'prescreenName', 'prescreen_name', 'Pre_Screen_Name'
    ]);
    if (preScreenName !== undefined) payload.PreScreenName = preScreenName;
    for (const alias of ['prescreenName', 'prescreen_name', 'Pre_Screen_Name']) {
        delete payload[alias];
    }

    const linkType = pickFirstDefined(payload, [
        'Project_Link_Type', 'project_link_type', 'projectLinkType', 'linkType', 'LinkType'
    ]);
    if (linkType !== undefined) {
        payload.Project_Link_Type = normalizeProjectLinkType(linkType);
    }
    for (const alias of ['project_link_type', 'projectLinkType', 'linkType', 'LinkType']) {
        delete payload[alias];
    }

    return payload;
};

const ProjectUrl = {
generateUrlCode: async (project_id, conn = db) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    let code;
    let exists = true;

    while (exists) {
        let letterPart = '';
        for (let i = 0; i < 3; i++) {
            letterPart += letters[crypto.randomInt(0, letters.length)];
        }

        let digitPart = '';
        for (let i = 0; i < 3; i++) {
            digitPart += digits[crypto.randomInt(0, digits.length)];
        }

        code = letterPart + digitPart;

        const [rows] = await conn.execute(
            `SELECT id FROM project_url_Info WHERE project_url_code = ?`, [code]
        );
        exists = rows.length > 0;
    }

    return code;

},

    create: async (data, conn = db) => {
        const normalized = normalizeUrlPayload(data);
        const {
            project_id, description, LOI, IR, country, CPI, SampleSize,
            Start_Date, End_Date, Status, Live_Link, Test_Link,
            GeoLocation, UrlProtection, UniqueIP, PreScreen, FraudDetection,
            Language, PreScreenid, PreScreenName,
            TerminationPoint, CompletionPoint, ValidatePoint,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
            Project_Link_Type, action_by
        } = normalized;

        const project_url_code = await ProjectUrl.generateUrlCode(conn);

        const [result] = await conn.execute(
            `INSERT INTO project_url_Info
             (project_id, project_url_code, description, \`LOI(Minute)\`, \`IR(%)\`, country, CPI, SampleSize,
              Start_Date, End_Date, Status, Live_Link, Test_Link,
              GeoLocation, UrlProtection, UniqueIP, PreScreen, FraudDetection,
              Language, PreScreenid, PreScreenName,
              TerminationPoint, CompletionPoint, ValidatePoint,
              CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
              Project_Link_Type, action_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                project_id,
                project_url_code,
                toNullable(description),
                toNullable(LOI),
                toNullable(IR),
                toNullable(country),
                toNullable(CPI),
                toNullable(SampleSize),
                toNullable(Start_Date),
                toNullable(End_Date),
                Status || 'active',
                toNullable(Live_Link),
                toNullable(Test_Link),
                toIntFlag(GeoLocation, 0),
                toIntFlag(UrlProtection, 0),
                toIntFlag(UniqueIP, 0),
                toIntFlag(PreScreen, 0),
                toIntFlag(FraudDetection, 0),
                toNullable(Language),
                PreScreenid != null && String(PreScreenid).trim() !== ''
                    ? String(PreScreenid).trim()
                    : null,
                toNullable(PreScreenName),
                toNullable(TerminationPoint),
                toNullable(CompletionPoint),
                toNullable(ValidatePoint),
                toNullable(CompleteURL),
                toNullable(TerminateURL),
                toNullable(OverQuotaURL),
                toNullable(QualityTermURL),
                toNullable(SurveyCloseURL),
                toNullable(Project_Link_Type),
                action_by || null
            ]
        );
        return result.insertId;
    },

    getByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE project_id = ? AND (deleted_at IS NULL)`, [project_id]
        );
        return rows;
    },

    getSampleSizeByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT COALESCE(SUM(SampleSize), 0) AS sampleSize
             FROM project_url_Info
             WHERE project_id = ? AND deleted_at IS NULL`,
            [project_id]
        );
        return Number(rows[0]?.sampleSize || 0);
    },

    getById: async (id) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`, [id]
        );
        return rows[0] || null;
    },

    getByCode: async (project_url_code) => {
        const [rows] = await db.execute(
            `SELECT * FROM project_url_Info
             WHERE project_url_code = ? AND deleted_at IS NULL
             LIMIT 1`,
            [String(project_url_code || '').trim()]
        );
        return rows[0] || null;
    },

    update: async (id, data) => {
        const columnMap = {
            LOI: '`LOI(Minute)`',
            IR: '`IR(%)`'
        };

        const safeData = normalizeUrlPayload(data);
        delete safeData.project_url_code;
        delete safeData.id;
        delete safeData.project_id;
        delete safeData.created_at;
        delete safeData.deleted_at;
        delete safeData.deleted_by;
        delete safeData.action_by;
        delete safeData.partner_id;
        delete safeData.metadata;
        delete safeData.file;

        // Normalize flag/id types — hasOwn so explicit 0 is kept
        for (const flag of FLAG_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(safeData, flag)) {
                safeData[flag] = toIntFlag(safeData[flag], 0);
            }
        }
        if (Object.prototype.hasOwnProperty.call(safeData, 'PreScreenid')) {
            safeData.PreScreenid =
                safeData.PreScreenid != null && String(safeData.PreScreenid).trim() !== ''
                    ? String(safeData.PreScreenid).trim()
                    : null;
        }
        if (Object.prototype.hasOwnProperty.call(safeData, 'Project_Link_Type')) {
            // Already normalized in normalizeUrlPayload; keep null if invalid/empty
            safeData.Project_Link_Type = safeData.Project_Link_Type || null;
        }

        const setClauses = [];
        const values = [];
        for (const key of Object.keys(safeData)) {
            if (!ALLOWED_UPDATE_FIELDS.has(key)) continue;
            const column = columnMap[key] || `\`${key}\``;
            setClauses.push(`${column} = ?`);
            values.push(FLAG_FIELDS.includes(key) ? Number(safeData[key]) : safeData[key]);
        }
        if (!setClauses.length) return null;

        const [result] = await db.execute(
            `UPDATE project_url_Info SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
            [...values, id]
        );
        return result;
    },

    delete: async (id, deleted_by) => {
        const [result] = await db.execute(
            `UPDATE project_url_Info SET deleted_at = NOW(), deleted_by = ? WHERE id = ?`,
            [deleted_by || null, id]
        );
        return result;
    },

    toggleLinkMode: async (id, link_mode) => {
        const [result] = await db.execute(
            `UPDATE project_url_Info SET link_mode = ?, updated_at = NOW() WHERE id = ?`,
            [link_mode, id]
        );
        return result;
    },
  getEligibleByProjectId: async (project_id) => {
        const [rows] = await db.execute(
            `SELECT id, project_url_code, Status, link_mode, Live_Link, Test_Link
             FROM project_url_Info
             WHERE project_id = ? AND deleted_at IS NULL AND Status = 'Open'
             ORDER BY id DESC`,
            [project_id]
        );
        return rows;
    },

    getActiveLink: async (id) => {
        const [rows] = await db.execute(
            `SELECT id, project_id, link_mode, Test_Link, Live_Link, Status
             FROM project_url_Info WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        if (!rows.length) return null;

        const urlInfo = rows[0];
        const activeLink = urlInfo.link_mode === 'live' ? urlInfo.Live_Link : urlInfo.Test_Link;

        return {
            id: urlInfo.id,
            project_id: urlInfo.project_id,
            link_mode: urlInfo.link_mode,
            active_link: activeLink
        };
    }
};

export default ProjectUrl;
