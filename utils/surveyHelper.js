import crypto from 'crypto';
import { decodeSurveyToken } from './Encryptionhelper.js';
import surveyPreScreenResponse from '../models/pre-screenResponseModel.js';
import SurveyData from '../models/surveyDataModel.js';
import ProjectUrl from '../models/projectUrlModel.js';

export const ALLOWED_PRESCREEN_STATUSES = [
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED',
    'TERMINATED'
];

/** Known non-X placeholders partners sometimes leave in links */
export const PLACEHOLDER_UIDS = new Set([
    '',
    '[identifier]',
    '%5Bidentifier%5D',
    'null',
    'undefined',
    'xxxxxx'
]);

export const INVALID_LINK_UID_MESSAGE =
    'This survey link is invalid or incomplete. Please use the link provided by your survey partner.';

export const SURVEY_STATUS_ALIASES = {
    completed: 'completed',
    complete: 'completed',
    terminate: 'terminate',
    terminated: 'terminate',
    'quota full': 'Quota full',
    quotafull: 'Quota full',
    overquota: 'Quota full',
    'over quota': 'Quota full',
    qualityterm: 'qualityTerm',
    'quality term': 'qualityTerm',
    surveyclosed: 'surveyClosed',
    'survey closed': 'surveyClosed',
    surveyclose: 'surveyClosed'
};

export const normalizeSurveyStatus = (raw) => {
    const key = String(raw || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    return SURVEY_STATUS_ALIASES[key] || null;
};

export const isMultiLinkProject = (type) =>
    String(type || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'multilink';

export const appendUidToLink = (link, userId) => {
    const base = String(link || '');
    const uid = encodeURIComponent(userId);

    if (/[?&]uid=/i.test(base)) {
        return base.replace(/([?&]uid=)[^&#]*/i, `$1${uid}`);
    }

    return base.includes('?')
        ? `${base}&uid=${uid}`
        : `${base}?uid=${uid}`;
};

export const appendPidToLink = (link, pid) => {
    const base = String(link || '');
    const pidEncoded = encodeURIComponent(pid);

    if (pid == null || pid === '') return base;

    if (/[?&]pid=/i.test(base)) {
        return base.replace(/([?&]pid=)[^&#]*/i, `$1${pidEncoded}`);
    }

    return base.includes('?')
        ? `${base}&pid=${pidEncoded}`
        : `${base}?pid=${pidEncoded}`;
};

export const normalizeUid = (uid) => {
    if (uid == null) return '';
    let value = String(uid).trim();
    try {
        value = decodeURIComponent(value);
    } catch {
        // keep raw
    }
    return value.trim();
};

/** True when uid is present but is a placeholder (e.g. X, XXXXXX, [identifier]). */
export const isPlaceholderUid = (uid) => {
    const value = normalizeUid(uid);
    if (!value) return false;
    if (/^x+$/i.test(value)) return true;
    const lower = value.toLowerCase();
    return PLACEHOLDER_UIDS.has(lower) || PLACEHOLDER_UIDS.has(value);
};

export const isValidUid = (uid) => {
    const value = normalizeUid(uid);
    if (!value) return false;
    return !isPlaceholderUid(value);
};

/** Alphanumeric respondent id when uid query/body is omitted. */
export const generateSurveyUid = (length = 16) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
};

/**
 * Resolve respondent uid:
 * - missing/empty → generate (when allowGenerate)
 * - placeholder (X / XXXXXX / [identifier] / …) → error
 * - real value → use as-is
 *
 * @returns {{ uid: string, generated: boolean } | { error: string }}
 */
export const resolveSurveyUid = (rawUid, { allowGenerate = true } = {}) => {
    const hasParam =
        rawUid !== undefined &&
        rawUid !== null &&
        String(rawUid).trim() !== '';

    if (!hasParam) {
        if (!allowGenerate) {
            return { error: 'uid is required!' };
        }
        return { uid: generateSurveyUid(), generated: true };
    }

    const value = normalizeUid(rawUid);
    if (isPlaceholderUid(value)) {
        return { error: INVALID_LINK_UID_MESSAGE };
    }
    if (!value) {
        if (!allowGenerate) {
            return { error: 'uid is required!' };
        }
        return { uid: generateSurveyUid(), generated: true };
    }

    return { uid: value, generated: false };
};

/**
 * Real client IP behind Nginx/load balancers.
 * Prefers Express `req.ip` when `trust proxy` is set (server.js), so hop counts
 * are respected instead of blindly trusting the left-most X-Forwarded-For value.
 */
export const getClientIp = (req) => {
    let ip = '';

    if (req?.ip) {
        ip = String(req.ip).trim();
    } else if (typeof req?.headers?.['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].trim()) {
        ip = req.headers['x-forwarded-for'].split(',')[0].trim();
    } else {
        ip = req?.socket?.remoteAddress || '';
    }

    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    // Strip surrounding brackets from IPv6 literals if present
    if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
    return String(ip).slice(0, 45);
};

export const decodeToken = (rawToken) => {
    if (!rawToken || typeof rawToken !== 'string') {
        const err = new Error('token is required!');
        err.statusCode = 400;
        throw err;
    }

    try {
        const tokenData = decodeSurveyToken(rawToken.trim());
        if (tokenData?.projectid == null || tokenData?.projectUrlId == null) {
            const err = new Error('Invalid token payload!');
            err.statusCode = 400;
            throw err;
        }
        return tokenData;
    } catch (e) {
        if (e.statusCode) throw e;
        const err = new Error('Invalid or corrupted token!');
        err.statusCode = 400;
        throw err;
    }
};

export const createHttpError = (statusCode, message) => {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
};

const UPDATABLE_SURVEY_STATUSES = new Set(['initiated', 'active']);

export const isUpdatableSurveyStatus = (status) =>
    UPDATABLE_SURVEY_STATUSES.has(String(status || '').trim().toLowerCase());

const STATUS_URL_FIELDS = {
    completed: 'CompleteURL',
    terminate: 'TerminateURL',
    'Quota full': 'OverQuotaURL',
    qualityTerm: 'QualityTermURL',
    surveyClosed: 'SurveyCloseURL'
};

export const getStatusRedirectUrl = (mapping, status, uid) => {
    const field = STATUS_URL_FIELDS[status];
    const url = mapping?.[field] || null;
    if (!url) return null;
    return uid ? appendUidToLink(url, uid) : url;
};

/**
 * Resolve project_url_Info from survey token (and optional pid code fallback).
 */
export const resolveProjectUrlForSurvey = async (tokenData, pidRaw) => {
    const projectid = Number(tokenData?.projectid);
    const tokenUrlId = Number(tokenData?.projectUrlId);

    let urlInfo =
        Number.isFinite(tokenUrlId) && tokenUrlId > 0
            ? await ProjectUrl.getById(tokenUrlId)
            : null;

    if (
        urlInfo &&
        Number.isFinite(projectid) &&
        Number(urlInfo.project_id) !== projectid
    ) {
        urlInfo = null;
    }

    const pid = String(pidRaw ?? '').trim();
    if (!urlInfo && pid) {
        const byCode = await ProjectUrl.getByCode(pid);
        if (byCode) {
            urlInfo = byCode;
        }
    }

    return {
        urlInfo,
        projectid: urlInfo ? Number(urlInfo.project_id) : projectid,
        project_url_id: urlInfo ? Number(urlInfo.id) : tokenUrlId
    };
};

export const getPreScreenResponseId = async ({
    projectId,
    projectUrlId,
    UserId,
    partnerid = null
}) => {
    if (!UserId) return null;

    const surveyData = await SurveyData.findByUserId({
        partnerid,
        projectid: projectId,
        project_url_id: projectUrlId,
        UserId
    });

    if (!surveyData) {
        return null;
    }

    const preScreenResponse =
        await surveyPreScreenResponse.getPreScreenResponseIdBySurveyDataIdUserId(
            surveyData.id,
            UserId || surveyData.UserId
        );

    if (!preScreenResponse) {
        return null;
    }

    return preScreenResponse.id;
};
