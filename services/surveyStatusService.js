import SurveyData from '../models/surveyDataModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import Project from '../models/projectModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';
import {
    normalizeSurveyStatus,
    isMultiLinkProject,
    normalizeUid,
    isValidUid,
    createHttpError,
    getStatusRedirectUrl,
    isUpdatableSurveyStatus
} from '../utils/surveyHelper.js';

export const finalizeSurveyOutcome = async ({ pid, uid, status, clientIp }) => {
    const Status = normalizeSurveyStatus(status);
    if (!Status) {
        throw createHttpError(
            400,
            'surveyStatus is required! Allowed: completed, terminate, Quota full, qualityTerm, surveyClosed'
        );
    }

    if (!pid || String(pid).trim() === '') {
        throw createHttpError(400, 'pid is required!');
    }

    const UserId = normalizeUid(uid);
    if (!isValidUid(UserId)) {
        throw createHttpError(400, 'uid is required!');
    }

    const urlInfo = await ProjectUrl.getByCode(pid);
    if (!urlInfo) {
        throw createHttpError(404, 'Project URL not found for given pid!');
    }

    const project_url_id = Number(urlInfo.id);
    const projectid = Number(urlInfo.project_id);
    const project = await Project.getById(projectid);
    if (!project) {
        throw createHttpError(404, 'Project not found!');
    }

    const mapping = await SupplierMapping.getByProjectAndUrl(projectid, project_url_id);
    const partnerid = mapping?.partnerid != null ? Number(mapping.partnerid) : null;
    if (partnerid == null || !Number.isFinite(partnerid)) {
        throw createHttpError(400, 'Partner to the link not mapped.');
    }

    const multiLink = isMultiLinkProject(urlInfo.Project_Link_Type);
    let multiLinkRow = null;

    if (multiLink) {
        multiLinkRow = await ProjectMultipleUrl.getSurveyByAccess({
            project_id: projectid,
            project_url_id,
            Vender_UserName: UserId,
            partner_id: partnerid
        });

        if (!multiLinkRow) {
            throw createHttpError(404, 'Multi-link row not found for this pid, uid and partner!');
        }
    }

    if (multiLink && !isUpdatableSurveyStatus(multiLinkRow.Status)) {
        throw createHttpError(409, 'Status already filled.');
    }

    const result = await SurveyData.finalizeStatus({
        partnerid,
        projectid,
        project_url_id,
        UserId,
        Status,
        FinalIP: clientIp
    });

    if (!result) {
        throw createHttpError(404, 'Survey activity not found for this partner, project, url and uid!');
    }

    if (result.alreadyFilled) {
        throw createHttpError(409, 'Status already filled.');
    }

    if (multiLink && multiLinkRow) {
        await ProjectMultipleUrl.updateStatusByAccess({
            project_id: projectid,
            project_url_id,
            partner_id: partnerid,
            Vender_UserName: UserId,
            Status
        });
    }

    return {
        surveyStatus: Status,
        pid: String(pid).trim(),
        uid: UserId,
        project_id: projectid,
        project_url_id,
        partnerid,
        redirect_url: getStatusRedirectUrl(mapping, Status, UserId)
    };
};
