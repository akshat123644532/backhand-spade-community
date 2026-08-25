import { decodeSurveyToken } from './Encryptionhelper.js';
import surveyPreScreenResponse from '../models/pre-screenResponseModel.js';
import SurveyData from '../models/surveyDataModel.js';

export const ALLOWED_PRESCREEN_STATUSES = [
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED',
    'TERMINATED'
];
export const PLACEHOLDER_UIDS = new Set(['', '[identifier]', '%5Bidentifier%5D', 'null', 'undefined', 'xxxxxx']);

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

export const isValidUid = (uid) => {
    const value = normalizeUid(uid);
    if (!value) return false;
    return !PLACEHOLDER_UIDS.has(value.toLowerCase()) && !PLACEHOLDER_UIDS.has(value);
};

export const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    let ip = '';
    if (typeof forwarded === 'string' && forwarded.trim()) {
        ip = forwarded.split(',')[0].trim();
    } else {
        ip = req.ip || req.socket?.remoteAddress || '';
    }
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    return String(ip).slice(0, 20);
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

export const getPreScreenResponseId = async (projectId, projectUrlId) => {
    const surveyData = await SurveyData.getId(projectId, projectUrlId);

    if (!surveyData) {
        return null;
    }

    const preScreenResponse =
        await surveyPreScreenResponse.getPreScreenResponseIdBySurveyDataIdUserId(
            surveyData.id,
            surveyData.UserId
        );

    if (!preScreenResponse) {
        return null;
    }

    return preScreenResponse.id;
};
