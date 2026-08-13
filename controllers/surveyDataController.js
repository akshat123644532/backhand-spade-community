import { decodeSurveyToken } from '../utils/Encryptionhelper.js';
import SurveyData from '../models/surveyDataModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import Project from '../models/projectModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';
import QuestionnaireGroup from '../models/Questionnairegroupmodel.js';

const PLACEHOLDER_UIDS = new Set(['', '[identifier]', '%5Bidentifier%5D', 'null', 'undefined', 'xxxxxx']);

const SURVEY_STATUS_ALIASES = {
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

const normalizeSurveyStatus = (raw) => {
    const key = String(raw || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    return SURVEY_STATUS_ALIASES[key] || null;
};

const isMultiLinkProject = (type) =>
    String(type || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'multilink';

const appendRespondentId = (link, userId) => {
    const base = String(link);
    return base.includes('?')
        ? `${base}&respondent_id=${encodeURIComponent(userId)}`
        : `${base}?respondent_id=${encodeURIComponent(userId)}`;
};

/** Prefer token partner when valid (>0); otherwise resolve by project + url. */
const resolveSupplierMapping = async (partnerid, projectid, project_url_id) => {
    let mapping = null;
    if (Number.isFinite(partnerid) && partnerid > 0) {
        mapping = await SupplierMapping.getByPartnerProjectUrl(partnerid, projectid, project_url_id);
    }
    if (!mapping) {
        mapping = await SupplierMapping.getByProjectAndUrl(projectid, project_url_id);
    }
    return mapping;
};

const decodeToken = (rawToken) => {
    if (!rawToken || typeof rawToken !== 'string') {
        const err = new Error('token is required!');
        err.statusCode = 400;
        throw err;
    }

    try {
        const tokenData = decodeSurveyToken(rawToken.trim());
        // partnerid can be null (e.g. multi-link / vendor flows)
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

const normalizeUid = (uid) => {
    if (uid == null) return '';
    let value = String(uid).trim();
    try {
        value = decodeURIComponent(value);
    } catch {
        // keep raw
    }
    return value.trim();
};

const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    let ip = '';
    if (typeof forwarded === 'string' && forwarded.trim()) {
        ip = forwarded.split(',')[0].trim();
    } else {
        ip = req.ip || req.socket?.remoteAddress || '';
    }
    if (ip.startsWith('::ffff:')) ip = ip.slice(7);
    // Column InitalIP is varchar(20)
    return String(ip).slice(0, 20);
};

/**
 * POST /api/survey/activity
 * Body/query: { token, uid }
 * Creates survey activity with Status = Initiated and InitalIP = client IP.
 * Blocks if same partnerid + projectid + project_url_id + UserId + InitalIP
 * already exists with Status other than Initiated.
 * Also binds uid → Vender_UserName on project_mutiple_Url for project + url + partner.
 */
export const addSurveyActivity = async (req, res) => {
    try {
        const token = req.body?.token || req.query?.token;
        const uidRaw = req.body?.uid ?? req.query?.uid;
        const tokenData = decodeToken(token);

        const UserId = normalizeUid(uidRaw);
        if (!UserId || PLACEHOLDER_UIDS.has(UserId.toLowerCase()) || PLACEHOLDER_UIDS.has(UserId)) {
            return res.status(400).json({
                success: false,
                message: 'uid is required! Replace [identifier] with the respondent id.'
            });
        }

        let partnerid =
            tokenData.partnerid == null || tokenData.partnerid === ''
                ? null
                : Number(tokenData.partnerid);
        const projectid = Number(tokenData.projectid);
        const project_url_id = Number(tokenData.projectUrlId);
        const InitalIP = getClientIp(req);

        if (
            (partnerid != null && !Number.isFinite(partnerid)) ||
            !Number.isFinite(projectid) ||
            !Number.isFinite(project_url_id)
        ) {
            return res.status(400).json({ success: false, message: 'Invalid token ids!' });
        }

        // Resolve partner from multi-link mapping when token has none
        if (partnerid == null || !Number.isFinite(partnerid)) {
            partnerid = await ProjectMultipleUrl.getMappedPartnerId(projectid, project_url_id);
            if (partnerid == null || !Number.isFinite(partnerid)) {
                return res.status(400).json({
                    success: false,
                    message: 'Partner to the link not mapped.'
                });
            }
        }

        // Optional window check from token dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (tokenData.startDate && new Date(tokenData.startDate) > today) {
            return res.status(403).json({ success: false, message: 'Survey has not started yet!' });
        }
        if (tokenData.endDate && new Date(tokenData.endDate) < today) {
            return res.status(403).json({ success: false, message: 'Survey is closed!' });
        }

        // Exact combo: partner + project + url + UserId + IP
        const initiatedExact = await SurveyData.findInitiated({
            partnerid, projectid, project_url_id, UserId, InitalIP
        });
        if (initiatedExact) {
            // Same combination + Initiated → do nothing
            const multiLinkRow = await ProjectMultipleUrl.bindUidOnSurveyStart({
                project_id: projectid,
                project_url_id,
                partner_id: partnerid,
                uid: UserId
            });
            return res.status(200).json({
                success: true,
                message: 'Survey activity already initiated!',
                data: {
                    ...initiatedExact,
                    multi_link_id: multiLinkRow?.id || null,
                    Vender_UserName: multiLinkRow?.Vender_UserName || UserId
                }
            });
        }

        const blocked = await SurveyData.findBlockedAccess({
            partnerid, projectid, project_url_id, UserId, InitalIP
        });
        if (blocked) {
            return res.status(403).json({
                success: false,
                message: 'No access — survey already filled or in progress for this user.',
                code: 'ALREADY_FILLED',
                data: { id: blocked.id, Status: blocked.Status }
            });
        }

        // UserId + InitalIP must be unique within partnerid + projectid + project_url_id
        const existingByUser = await SurveyData.findByUserId({
            partnerid, projectid, project_url_id, UserId
        });
        if (existingByUser && String(existingByUser.InitalIP || '') !== String(InitalIP || '')) {
            return res.status(403).json({
                success: false,
                message: 'User not allowed from the current ip.',
                code: 'IP_NOT_ALLOWED'
            });
        }

        const existingByIp = await SurveyData.findByInitialIp({
            partnerid, projectid, project_url_id, InitalIP
        });
        if (existingByIp && String(existingByIp.UserId || '').toLowerCase() !== String(UserId).toLowerCase()) {
            console.warn(
                `[SurveyActivity] UID mismatch on same IP — not blocking. ` +
                `IP=${InitalIP}, incomingUid=${UserId}, existingUid=${existingByIp.UserId}, ` +
                `partnerid=${partnerid}, projectid=${projectid}, project_url_id=${project_url_id}`
            );
        }

        // Bind uid → Vender_UserName on multi-link row (project + url + partner)
        const multiLinkRow = await ProjectMultipleUrl.bindUidOnSurveyStart({
            project_id: projectid,
            project_url_id,
            partner_id: partnerid,
            uid: UserId
        });

        const id = await SurveyData.createInitiated({
            partnerid, projectid, project_url_id, UserId, InitalIP
        });
        const row = await SurveyData.getById(id);

        return res.status(201).json({
            success: true,
            message: 'Survey activity initiated successfully!',
            data: {
                ...row,
                multi_link_id: multiLinkRow?.id || null,
                Vender_UserName: multiLinkRow?.Vender_UserName || UserId
            }
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Server error!' : error.message,
            error: error.message
        });
    }
};

/**
 * POST|GET /api/survey/prescreen
 * Body/query: { token }
 * If project_url_Info.PreScreen = 1, return questions for PreScreenid group.
 */
export const getSurveyPreScreen = async (req, res) => {
    try {
        const token = req.body?.token || req.query?.token;
        const tokenData = decodeToken(token);

        const projectid = Number(tokenData.projectid);
        const project_url_id = Number(tokenData.projectUrlId);

        const urlInfo = await ProjectUrl.getById(project_url_id);
        if (!urlInfo) {
            return res.status(404).json({ success: false, message: 'Project URL not found!' });
        }

        if (Number(urlInfo.project_id) !== projectid) {
            return res.status(400).json({
                success: false,
                message: 'Token projectid does not match project_url_id!'
            });
        }

        const preScreenFlag = Number(urlInfo.PreScreen) === 1;
        if (!preScreenFlag) {
            return res.status(200).json({
                success: true,
                required: false,
                message: 'No PreScreen required'
            });
        }

        const preScreenId = urlInfo.PreScreenid;
        if (preScreenId == null || String(preScreenId).trim() === '') {
            return res.status(400).json({
                success: false,
                required: true,
                message: 'PreScreen is enabled but PreScreenid is missing!'
            });
        }

        const group = await QuestionnaireGroup.getById(preScreenId);
        if (!group) {
            return res.status(404).json({
                success: false,
                required: true,
                message: 'PreScreen questionnaire group not found!'
            });
        }
        if (group.status === 'inactive') {
            return res.status(403).json({
                success: false,
                required: true,
                message: 'PreScreen questionnaire is not active!'
            });
        }

        return res.status(200).json({
            success: true,
            required: true,
            message: 'PreScreen required',
            data: {
                PreScreen: 1,
                PreScreenid: group.id,
                PreScreenName: urlInfo.PreScreenName || group.surveyTitle,
                surveyTitle: group.surveyTitle,
                language: group.language,
                questions: group.questions || []
            }
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Server error!' : error.message,
            error: error.message
        });
    }
};

/**
 * GET /api/survey/link?token=...&uid=...
 * MultiLink → supplier_mapping partner → first active project_mutiple_Url Live_Link
 * SingleLink → supplier_mapping.IsTest: 1 → Test_Link, 0 → Live_Link (from project_url_Info)
 */
export const getSurveyLink = async (req, res) => {
    try {
        const token = req.query?.token || req.body?.token;
        const uidRaw = req.query?.uid ?? req.body?.uid;
        const tokenData = decodeToken(token);
        const UserId = normalizeUid(uidRaw);
        if (!UserId || PLACEHOLDER_UIDS.has(UserId.toLowerCase()) || PLACEHOLDER_UIDS.has(UserId)) {
            return res.status(400).json({
                success: false,
                message: 'uid is required! Use the respondent email / Vender_UserName.'
            });
        }

        const projectid = Number(tokenData.projectid);
        const project_url_id = Number(tokenData.projectUrlId);
        const partnerid =
            tokenData.partnerid == null || tokenData.partnerid === ''
                ? null
                : Number(tokenData.partnerid);

        if (!Number.isFinite(projectid) || !Number.isFinite(project_url_id)) {
            return res.status(400).json({ success: false, message: 'Invalid token ids!' });
        }

        // Optional window check from token dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (tokenData.startDate && new Date(tokenData.startDate) > today) {
            return res.status(403).json({ success: false, message: 'Survey has not started yet!' });
        }
        if (tokenData.endDate && new Date(tokenData.endDate) < today) {
            return res.status(403).json({ success: false, message: 'Survey is closed!' });
        }

        const urlInfo = await ProjectUrl.getById(project_url_id);
        if (!urlInfo || Number(urlInfo.project_id) !== projectid) {
            return res.status(404).json({
                success: false,
                message: 'No survey found for this token and uid!'
            });
        }

        const multiLink = isMultiLinkProject(urlInfo.Project_Link_Type);
        const mapping = await resolveSupplierMapping(partnerid, projectid, project_url_id);
        if (!mapping) {
            return res.status(400).json({
                success: false,
                message: 'Partner to the link not mapped.'
            });
        }

        // ── MultiLink: partner from mapping → first active multi-url Live_Link ──
        if (multiLink) {
            const resolvedPartnerId = Number(mapping.partnerid);
            if (!Number.isFinite(resolvedPartnerId) || resolvedPartnerId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Partner to the link not mapped.'
                });
            }

            const multiRow = await ProjectMultipleUrl.getFirstActiveByPartnerProjectUrl({
                project_id: projectid,
                project_url_id,
                partner_id: resolvedPartnerId
            });

            if (!multiRow) {
                return res.status(404).json({
                    success: false,
                    message: 'No active Live_Link found for this partner/project URL!'
                });
            }
            if (!multiRow.Live_Link) {
                return res.status(404).json({
                    success: false,
                    message: 'Live_Link not configured for this multi-link row!'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Survey link fetched successfully!',
                data: {
                    project_id: multiRow.project_id,
                    project_url_id: multiRow.project_url_id,
                    partner_id: multiRow.partner_id,
                    Vender_UserName: UserId,
                    Live_Link: multiRow.Live_Link,
                    survey_url: appendRespondentId(multiRow.Live_Link, UserId),
                    Status: multiRow.Status,
                    Project_Link_Type: urlInfo.Project_Link_Type || 'MultiLink'
                }
            });
        }

        // ── SingleLink: IsTest on supplier_mapping → Test_Link / Live_Link ──
        const isTest = Number(mapping.IsTest) === 1;
        const targetLink = isTest
            ? (urlInfo.Test_Link || null)
            : (urlInfo.Live_Link || null);

        if (!targetLink) {
            return res.status(404).json({
                success: false,
                message: isTest
                    ? 'Test_Link not configured for this project URL!'
                    : 'Live_Link not configured for this project URL!'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Survey link fetched successfully!',
            data: {
                project_id: projectid,
                project_url_id,
                Vender_UserName: UserId,
                IsTest: isTest ? 1 : 0,
                link_type: isTest ? 'test' : 'live',
                Live_Link: targetLink,
                survey_url: appendRespondentId(targetLink, UserId),
                Status: urlInfo.Status,
                Project_Link_Type: urlInfo.Project_Link_Type || 'SingleLink'
            }
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Server error!' : error.message,
            error: error.message
        });
    }
};

/**
 * POST|GET /api/survey/status
 * Params: surveyStatus, pid (project_url_code), uid
 * Allowed status: completed | terminate | Quota full | qualityTerm | surveyClosed
 * Multi-link: update project_mutiple_Url.Status + survery_data
 * Single-link: update survery_data only
 */
export const updateSurveyStatus = async (req, res) => {
    try {
        const surveyStatusRaw = req.body?.surveyStatus ?? req.query?.surveyStatus ?? req.body?.status ?? req.query?.status;
        const pid = req.body?.pid ?? req.query?.pid;
        const uidRaw = req.body?.uid ?? req.query?.uid;

        const Status = normalizeSurveyStatus(surveyStatusRaw);
        if (!Status) {
            return res.status(400).json({
                success: false,
                message: 'surveyStatus is required! Allowed: completed, terminate, Quota full, qualityTerm, surveyClosed'
            });
        }

        if (!pid || String(pid).trim() === '') {
            return res.status(400).json({ success: false, message: 'pid is required!' });
        }

        const UserId = normalizeUid(uidRaw);
        if (!UserId || PLACEHOLDER_UIDS.has(UserId.toLowerCase())) {
            return res.status(400).json({ success: false, message: 'uid is required!' });
        }

        const urlInfo = await ProjectUrl.getByCode(pid);
        if (!urlInfo) {
            return res.status(404).json({ success: false, message: 'Project URL not found for given pid!' });
        }

        const project_url_id = Number(urlInfo.id);
        const projectid = Number(urlInfo.project_id);
        const project = await Project.getById(projectid);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found!' });
        }

        const mapping = await SupplierMapping.getByProjectAndUrl(projectid, project_url_id);
        const partnerid = mapping?.partnerid != null ? Number(mapping.partnerid) : null;
        if (partnerid == null || !Number.isFinite(partnerid)) {
            return res.status(400).json({
                success: false,
                message: 'Partner to the link not mapped.'
            });
        }

        const FinalIP = getClientIp(req);
        let multiLinkRow = null;
        let multiLinkUpdated = 0;
        const multiLink = isMultiLinkProject(urlInfo.Project_Link_Type);

        if (multiLink) {
            multiLinkRow = await ProjectMultipleUrl.getSurveyByAccess({
                project_id: projectid,
                project_url_id,
                Vender_UserName: UserId,
                partner_id: partnerid
            });

            if (!multiLinkRow) {
                return res.status(404).json({
                    success: false,
                    message: 'Multi-link row not found for this pid, uid and partner!'
                });
            }
        }

        const surveyRow = await SurveyData.finalizeStatus({
            partnerid,
            projectid,
            project_url_id,
            UserId,
            Status,
            FinalIP
        });

        if (!surveyRow) {
            return res.status(404).json({
                success: false,
                message: 'Survey activity not found for this partner, project, url and uid!'
            });
        }

        if (multiLink && multiLinkRow) {
            multiLinkUpdated = await ProjectMultipleUrl.updateStatusByAccess({
                project_id: projectid,
                project_url_id,
                partner_id: partnerid,
                Vender_UserName: UserId,
                Status
            });
            multiLinkRow = { ...multiLinkRow, Status };
        }

        return res.status(200).json({
            success: true,
            message: `Survey status updated to ${Status}!`,
            data: {
                surveyStatus: Status,
                pid: String(pid).trim(),
                uid: UserId,
                project_id: projectid,
                project_url_id,
                partnerid,
                isMultiLink: multiLink,
                multi_link_updated: multiLinkUpdated,
                multi_link: multiLinkRow,
                survey: surveyRow
            }
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? 'Server error!' : error.message,
            error: error.message
        });
    }
};
