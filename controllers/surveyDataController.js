import SurveyData from '../models/surveyDataModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';
import QuestionnaireGroup from '../models/Questionnairegroupmodel.js';
import {decryptUid } from '../utils/linkSecurityHelper.js';
import surveyPreScreenResponse from '../models/pre-screenResponseModel.js';
import { decodeSurveyToken } from '../utils/Encryptionhelper.js';
import { appendUidToLink, appendPidToLink, normalizeUid, getClientIp, resolveProjectUrlForSurvey, resolveSurveyUid } from '../utils/surveyHelper.js';
import { finalizeSurveyOutcome } from '../services/surveyStatusService.js';
import surveyPreScreenAnswers from '../models/preScreenAnswers.js';
import { getPreScreenResponseId, ALLOWED_PRESCREEN_STATUSES } from '../utils/surveyHelper.js';

/** Decrypt if needed, then resolve: missing→generate (optional), placeholder→reject, real→use. */
const resolveIncomingUserId = (rawUidParam, { allowGenerate = false } = {}) => {
    let candidate = rawUidParam;
    if (typeof rawUidParam === 'string' && rawUidParam.trim()) {
        const decrypted = decryptUid(rawUidParam);
        if (decrypted !== null && decrypted !== undefined) {
            candidate = decrypted;
        }
    }
    return resolveSurveyUid(candidate, { allowGenerate });
};

/**
 * Resolve uid for survey APIs:
 * 1) real uid from request
 * 2) if missing → UserId from survery_data (Initiated), prefer same IP
 * 3) if still missing and allowGenerate → generate alphanumeric uid
 * Placeholders (X / XXXXXX) always rejected.
 */
const resolveUserIdWithSurveyFallback = async (req, tokenData, {
    allowGenerate = false,
    projectid = null,
    project_url_id = null,
    partnerid = null
} = {}) => {
    const rawUidParam = req.body?.uid ?? req.query?.uid ?? req.body?.UserId ?? req.query?.UserId;
    const hasUidParam =
        rawUidParam !== undefined &&
        rawUidParam !== null &&
        String(rawUidParam).trim() !== '';

    if (hasUidParam) {
        const resolved = resolveIncomingUserId(rawUidParam, { allowGenerate: false });
        if (resolved.error) return { error: resolved.error };
        return { UserId: resolved.uid, generated: false, fromSurveyData: false };
    }

    const pid = Number(projectid ?? tokenData?.projectid);
    const urlId = Number(project_url_id ?? tokenData?.projectUrlId);
    let partner = partnerid;
    if ((partner == null || !Number.isFinite(Number(partner))) && Number.isFinite(pid) && Number.isFinite(urlId)) {
        partner = await resolvePartnerId(tokenData, pid, urlId);
    }

    if (Number.isFinite(pid) && Number.isFinite(urlId)) {
        const existing = await SurveyData.findLatestInitiatedUserId({
            partnerid: partner != null && Number.isFinite(Number(partner)) ? Number(partner) : null,
            projectid: pid,
            project_url_id: urlId,
            InitalIP: getClientIp(req) || null
        });
        if (existing?.UserId) {
            return {
                UserId: String(existing.UserId),
                generated: false,
                fromSurveyData: true,
                survey_data_id: existing.id
            };
        }
    }

    if (allowGenerate) {
        const generated = resolveSurveyUid(undefined, { allowGenerate: true });
        if (generated.error) return { error: generated.error };
        return { UserId: generated.uid, generated: true, fromSurveyData: false };
    }

    return {
        error: 'uid is required! Call /api/survey/activity first or pass uid.'
    };
};

/** Resolve uid/UserId from body or query (supports encrypted uid). */
const resolveRequestUserId = (req, { allowGenerate = false } = {}) => {
    const rawUidParam = req.body?.uid ?? req.query?.uid ?? req.body?.UserId ?? req.query?.UserId;
    const resolved = resolveIncomingUserId(rawUidParam, { allowGenerate });
    if (resolved.error) {
        return { error: resolved.error };
    }
    return { UserId: resolved.uid, generated: !!resolved.generated };
};

export const sendError = (res, error) => {
    const statusCode = error.statusCode || 500;
    const payload = {
        success: false,
        message: statusCode === 500 ? 'Server error!' : error.message,
        error: error.message
    };
    if (error.code) payload.code = error.code;
    return res.status(statusCode).json(payload);
};

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

/** Resolve partnerid the same way as survey activity initiation. */
const resolvePartnerId = async (tokenData, projectid, project_url_id) => {
    let partnerid =
        tokenData.partnerid == null || tokenData.partnerid === ''
            ? null
            : Number(tokenData.partnerid);

    if (partnerid == null || !Number.isFinite(partnerid)) {
        partnerid = await ProjectMultipleUrl.getMappedPartnerId(projectid, project_url_id);
    }
    if (partnerid == null || !Number.isFinite(partnerid)) {
        const mapping = await SupplierMapping.getByProjectAndUrl(projectid, project_url_id);
        partnerid = mapping?.partnerid != null ? Number(mapping.partnerid) : null;
    }
    return partnerid;
};

export const addSurveyActivity = async (req, res) => {
    try {
        const token = req.body?.token || req.query?.token;
        const rawUidParam = req.body?.uid ?? req.query?.uid;

        const resolvedUid = resolveIncomingUserId(rawUidParam, { allowGenerate: true });
        if (resolvedUid.error) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_UID',
                message: resolvedUid.error
            });
        }
        const UserId = resolvedUid.uid;

        const tokenData = decodeToken(token);

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

        // Load project URL config (UniqueIP, etc.)
        const urlInfo = await ProjectUrl.getById(project_url_id);
        if (!urlInfo) {
            return res.status(404).json({
                success: false,
                message: 'Project URL not found!'
            });
        }
        if (Number(urlInfo.project_id) !== projectid) {
            return res.status(400).json({
                success: false,
                message: 'Token projectid does not match project_url_id!'
            });
        }

        const uniqueIpEnabled = Number(urlInfo.UniqueIP) === 1;
        const lockKey = `sinit:${partnerid}:${projectid}:${project_url_id}`;

        const resultPayload = await SurveyData.withInitLock(lockKey, async () => {
            // 1) Existing UserId in scope partnerid + projectid + project_url_id
            const existingByUser = await SurveyData.findByUserId({
                partnerid, projectid, project_url_id, UserId
            });

            if (existingByUser) {
                if (SurveyData.isInitiatedStatus(existingByUser.Status)) {
                    // Same user + Initiated → resume; backfill GeoLocation if previous attempt missed it
                    const resumedRow = await SurveyData.backfillGeoLocationIfEmpty({
                        id: existingByUser.id,
                        ip: InitalIP || existingByUser.InitalIP
                    });

                    const multiLinkRow = await ProjectMultipleUrl.bindUidOnSurveyStart({
                        project_id: projectid,
                        project_url_id,
                        partner_id: partnerid,
                        uid: UserId
                    });
                    return {
                        httpStatus: 200,
                        body: {
                            success: true,
                            existing: true,
                            message: 'Existing survey session resumed.',
                            data: {
                                ...(resumedRow || existingByUser),
                                UserId,
                                uid: UserId,
                                uid_generated: !!resolvedUid.generated,
                                multi_link_id: multiLinkRow?.id || null,
                                Vender_UserName: multiLinkRow?.Vender_UserName || UserId
                            }
                        }
                    };
                }

                // Non-Initiated (completed / terminate / etc.) → block duplicate UserId
                console.warn(
                    `[SurveyActivity] DUPLICATE_USER_ID partnerid=${partnerid} projectid=${projectid} ` +
                    `project_url_id=${project_url_id} existingId=${existingByUser.id} status=${existingByUser.Status}`
                );
                return {
                    httpStatus: 403,
                    body: {
                        success: false,
                        code: 'DUPLICATE_USER_ID',
                        message: 'The project has already been initiated with this UserId.',
                        data: { id: existingByUser.id, Status: existingByUser.Status }
                    }
                };
            }

            // 2) UniqueIP = 1 → same partner/project/url + InitalIP cannot start again (any UserId)
            if (uniqueIpEnabled) {
                const existingByIp = await SurveyData.findByInitialIp({
                    partnerid, projectid, project_url_id, InitalIP
                });
                if (existingByIp) {
                    console.warn(
                        `[SurveyActivity] DUPLICATE_IP partnerid=${partnerid} projectid=${projectid} ` +
                        `project_url_id=${project_url_id} existingId=${existingByIp.id}`
                    );
                    return {
                        httpStatus: 403,
                        body: {
                            success: false,
                            code: 'DUPLICATE_IP',
                            message: 'Survey already initiated from this IP address.',
                            data: { id: existingByIp.id, Status: existingByIp.Status }
                        }
                    };
                }
            }

            // 3) Create new survey_data (+ pre-screen) — GeoLocation derived server-side from IP
            const multiLinkRow = await ProjectMultipleUrl.bindUidOnSurveyStart({
                project_id: projectid,
                project_url_id,
                partner_id: partnerid,
                uid: UserId
            });

            const id = await SurveyData.createInitiated({
                partnerid, projectid, project_url_id, UserId, InitalIP
            });

            const existingPreScreen =
                await surveyPreScreenResponse.getPreScreenResponseIdBySurveyDataIdUserId(id, UserId);
            if (!existingPreScreen) {
                const preScreenAdded = await surveyPreScreenResponse.createInitiated({
                    survey_data_id: id,
                    UserId
                });
                if (!preScreenAdded) {
                    return {
                        httpStatus: 400,
                        body: {
                            success: false,
                            message: 'Failed to add pre-screen response!'
                        }
                    };
                }
            }

            const row = await SurveyData.getById(id);
            return {
                httpStatus: 201,
                body: {
                    success: true,
                    existing: false,
                    message: 'Survey activity initiated successfully!',
                    data: {
                        ...row,
                        UserId,
                        uid: UserId,
                        uid_generated: !!resolvedUid.generated,
                        multi_link_id: multiLinkRow?.id || null,
                        Vender_UserName: multiLinkRow?.Vender_UserName || UserId
                    }
                }
            };
        });

        return res.status(resultPayload.httpStatus).json(resultPayload.body);
    } catch (error) {
        return sendError(res, error);
    }
};

/**
 * POST|GET /api/survey/prescreen
 * Body/query: { token, uid }
 * Looks up THIS user's survey + pre-screen status (not any user on the same project URL).
 * If project_url_Info.PreScreen = 1, return questions for PreScreenid group when IN_PROGRESS.
 */
export const getSurveyPreScreen = async (req, res) => {
    try {
        const token = req.body?.token || req.query?.token;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required!' });
        }

        const tokenData = decodeToken(token);
        const projectid = Number(tokenData.projectid);
        const project_url_id = Number(tokenData.projectUrlId);
        if (!Number.isFinite(projectid) || !Number.isFinite(project_url_id)) {
            return res.status(400).json({ success: false, message: 'Invalid token ids!' });
        }

        const partnerid = await resolvePartnerId(tokenData, projectid, project_url_id);
        const { UserId, error: uidError, generated, fromSurveyData } = await resolveUserIdWithSurveyFallback(
            req,
            tokenData,
            { allowGenerate: false, projectid, project_url_id, partnerid }
        );
        if (uidError) {
            return res.status(400).json({ success: false, code: 'INVALID_UID', message: uidError });
        }

        const urlInfo = await ProjectUrl.getById(project_url_id);
    
        if (!urlInfo) {
            return res.status(404).json({ success: false, message: 'Project URL not found!' });
        }

        if (Number(urlInfo.project_id) !== Number(projectid)) {
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
                message: 'No PreScreen required',
                data: { uid: UserId, UserId }
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

        if (partnerid == null || !Number.isFinite(partnerid)) {
            return res.status(400).json({
                success: false,
                message: 'Partner to the link not mapped.'
            });
        }

        // Scope by partner + project + url + THIS UserId (never another respondent)
        const surveyData = await SurveyData.findByUserId({
            partnerid,
            projectid,
            project_url_id,
            UserId
        });

        if (!surveyData) {
            return res.status(404).json({
                success: false,
                required: true,
                message: 'Survey data not found for this uid! Call /api/survey/activity first.'
            });
        }

        const preScreenResponseStatus =
            await surveyPreScreenResponse.getPreScreenResponseBySurveyDataIdUserId(
                surveyData.id,
                UserId
            );

        const status = preScreenResponseStatus?.status || 'IN_PROGRESS';

        if (status === 'COMPLETED') {
            return res.status(200).json({
                success: true,
                required: true,
                status: 'COMPLETED',
                message: 'PreScreen already completed!',
                data: {
                    UserId,
                    uid: UserId,
                    uid_generated: !!generated,
                    uid_from_survey_data: !!fromSurveyData,
                    survey_data_id: surveyData.id,
                    pre_screen_status: 'COMPLETED'
                }
            });
        }

        if (status === 'TERMINATED') {
            return res.status(200).json({
                success: true,
                required: true,
                status: 'TERMINATED',
                message: 'PreScreen already terminated!',
                data: {
                    UserId,
                    uid: UserId,
                    uid_generated: !!generated,
                    uid_from_survey_data: !!fromSurveyData,
                    survey_data_id: surveyData.id,
                    pre_screen_status: 'TERMINATED',
                    TerminateURL: urlInfo.TerminateURL || null
                }
            });
        }

        // IN_PROGRESS / Initiated → return questions for this user
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
            status: 'IN_PROGRESS',
            message: 'PreScreen required',
            data: {
                UserId,
                uid: UserId,
                uid_generated: !!generated,
                uid_from_survey_data: !!fromSurveyData,
                survey_data_id: surveyData.id,
                pre_screen_status: status,
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
        const tokenData = decodeToken(token);

        const { urlInfo, projectid, project_url_id } = await resolveProjectUrlForSurvey(
            tokenData,
            req.query?.pid ?? req.body?.pid
        );
        let partnerid =
            tokenData.partnerid == null || tokenData.partnerid === ''
                ? null
                : Number(tokenData.partnerid);

        if (!Number.isFinite(projectid) || !Number.isFinite(project_url_id)) {
            return res.status(400).json({ success: false, message: 'Invalid token ids!' });
        }

        if (partnerid == null || !Number.isFinite(partnerid)) {
            partnerid = await resolvePartnerId(tokenData, projectid, project_url_id);
        }

        // Missing uid → use Initiated survey_data UserId, else generate and append to survey_url
        const resolvedUid = await resolveUserIdWithSurveyFallback(req, tokenData, {
            allowGenerate: true,
            projectid,
            project_url_id,
            partnerid
        });
        if (resolvedUid.error) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_UID',
                message: resolvedUid.error
            });
        }
        const UserId = resolvedUid.uid || resolvedUid.UserId;

        // Optional window check from token dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (tokenData.startDate && new Date(tokenData.startDate) > today) {
            return res.status(403).json({ success: false, message: 'Survey has not started yet!' });
        }
        if (tokenData.endDate && new Date(tokenData.endDate) < today) {
            return res.status(403).json({ success: false, message: 'Survey is closed!' });
        }

        if (!urlInfo) {
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

            const survey_url = appendPidToLink(
                appendUidToLink(multiRow.Live_Link, UserId),
                pid
            );

            return res.status(200).json({
                success: true,
                message: 'Survey link fetched successfully!',
                data: {
                    project_id: multiRow.project_id,
                    project_url_id: multiRow.project_url_id,
                    partner_id: multiRow.partner_id,
                    uid: UserId,
                    UserId,
                    uid_generated: !!resolvedUid.generated,
                    uid_from_survey_data: !!resolvedUid.fromSurveyData,
                    Vender_UserName: UserId,
                    Live_Link: multiRow.Live_Link,
                    survey_url,
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

        const survey_url = appendPidToLink(
            appendUidToLink(targetLink, UserId),
            pid
        );

        return res.status(200).json({
            success: true,
            message: 'Survey link fetched successfully!',
            data: {
                project_id: projectid,
                project_url_id,
                uid: UserId,
                UserId,
                uid_generated: !!resolvedUid.generated,
                uid_from_survey_data: !!resolvedUid.fromSurveyData,
                Vender_UserName: UserId,
                IsTest: isTest ? 1 : 0,
                link_type: isTest ? 'test' : 'live',
                Live_Link: targetLink,
                survey_url,
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

export const savePreScreenResponse = async (req, res) => {
    try {
        const token = req.body?.token || req.query?.token;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required!'
            });
        }

        const tokenData = decodeToken(token);
        const projectid = Number(tokenData.projectid);
        const project_url_id = Number(tokenData.projectUrlId);
        const partnerid = await resolvePartnerId(tokenData, projectid, project_url_id);

        const { UserId, error: uidError } = await resolveUserIdWithSurveyFallback(req, tokenData, {
            allowGenerate: false,
            projectid,
            project_url_id,
            partnerid
        });
        if (uidError) {
            return res.status(400).json({ success: false, code: 'INVALID_UID', message: uidError });
        }

        const {
            question_id,
            question_text,
            question_type,
            answer
        } = req.body;

        if (
            !question_id ||
            !question_text ||
            !question_type ||
            answer === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: 'question_id, question_text, question_type and answer are required!'
            });
        }

        const preScreenResponseId = await getPreScreenResponseId({
            projectId: projectid,
            projectUrlId: project_url_id,
            UserId,
            partnerid
        });

        if (!preScreenResponseId) {
            return res.status(404).json({
                success: false,
                message: 'PreScreen response not found for this uid!'
            });
        }

        const preScreenAnswer =
            await surveyPreScreenAnswers.createOrUpdateAnswer({
                survey_prescreen_response_id: preScreenResponseId,
                question_id,
                question_text,
                question_type,
                answer
            });

        if (!preScreenAnswer) {
            return res.status(400).json({
                success: false,
                message: 'Failed to add pre-screen answer!'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'PreScreen answer added successfully!',
            data: { uid: UserId, UserId }
        });

    } catch (error) {
        return sendError(res, error);
    }
};

export const updatePreScreenResponseStatus = async (req, res) => {
    try {
        const token = req.body?.token || req.query?.token;
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required!'
            });
        }

        const tokenData = decodeToken(token);
        const projectid = Number(tokenData.projectid);
        const project_url_id = Number(tokenData.projectUrlId);
        const partnerid = await resolvePartnerId(tokenData, projectid, project_url_id);

        const { UserId, error: uidError } = await resolveUserIdWithSurveyFallback(req, tokenData, {
            allowGenerate: false,
            projectid,
            project_url_id,
            partnerid
        });
        if (uidError) {
            return res.status(400).json({ success: false, code: 'INVALID_UID', message: uidError });
        }

        const status = req.query?.status ?? req.body?.status;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: 'Status is required!'
            });
        }

        if (!ALLOWED_PRESCREEN_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status type!'
            });
        }

        const preScreenResponseId = await getPreScreenResponseId({
            projectId: projectid,
            projectUrlId: project_url_id,
            UserId,
            partnerid
        });

        if (!preScreenResponseId) {
            return res.status(404).json({
                success: false,
                message: 'PreScreen response not found for this uid!'
            });
        }
        
        const preScreenResponse = await surveyPreScreenResponse.updateStatus({
            id: preScreenResponseId,
            status
        });
        if (!preScreenResponse) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update pre-screen response status!'
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'PreScreen response status updated successfully!',
            data: { UserId, uid: UserId, status }
        });
    } catch (error) {
        return sendError(res, error);
    }
};