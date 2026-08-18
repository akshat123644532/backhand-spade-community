import SurveyData from '../models/surveyDataModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';
import QuestionnaireGroup from '../models/Questionnairegroupmodel.js';
import { finalizeSurveyOutcome } from '../services/surveyStatusService.js';
import {
    PLACEHOLDER_UIDS,
    isMultiLinkProject,
    appendUidToLink,
    appendPidToLink,
    decodeToken,
    normalizeUid,
    getClientIp
} from '../utils/surveyHelper.js';

const sendError = (res, error) => {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? 'Server error!' : error.message,
        error: error.message
    });
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
                message: 'Survey already COMPLETED',
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
        return sendError(res, error);
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
        return sendError(res, error);
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

        const pid =
            urlInfo.project_url_code ?? urlInfo.projectUrlCode ?? urlInfo.pid ?? null;

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
                    survey_url: appendPidToLink(
                        appendUidToLink(multiRow.Live_Link, UserId),
                        pid
                    ),
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
                survey_url: appendPidToLink(
                    appendUidToLink(targetLink, UserId),
                    pid
                ),
                Status: urlInfo.Status,
                Project_Link_Type: urlInfo.Project_Link_Type || 'SingleLink'
            }
        });
    } catch (error) {
        return sendError(res, error);
    }
};

const handleSurveyOutcome = (status) => async (req, res) => {
    try {
        const data = await finalizeSurveyOutcome({
            pid: req.body?.pid ?? req.query?.pid,
            uid: req.body?.uid ?? req.query?.uid,
            status,
            clientIp: getClientIp(req)
        });

        return res.status(200).json({
            success: true,
            message: `Survey status updated to ${status}!`,
            data
        });
    } catch (error) {
        return sendError(res, error);
    }
};

export const completeSurvey = handleSurveyOutcome('completed');
export const terminateSurvey = handleSurveyOutcome('terminate');
export const quotaFullSurvey = handleSurveyOutcome('Quota full');
export const qualityTermSurvey = handleSurveyOutcome('qualityTerm');
export const surveyClosedSurvey = handleSurveyOutcome('surveyClosed');
