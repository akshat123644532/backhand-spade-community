import SupplierMapping from '../models/supplierMappingModel.js';
import Partner from '../models/partnerModel.js';
import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';

export const addSupplierMapping = async (req, res) => {
    try {
        const {
            partnerid, projectid, projectUrlId, quota, CPI,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
            status, IsTest
        } = req.body;
        // Note: VenderURL is not accepted from client anymore — it's auto-generated

        if (!partnerid || !projectid || !projectUrlId) {
            return res.status(400).json({ success: false, message: "partnerid, projectid and projectUrlId are required!" });
        }

        const partner = await Partner.getById(partnerid);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });

        const project = await Project.getById(projectid);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const projectUrl = await ProjectUrl.getById(projectUrlId);
        if (!projectUrl) return res.status(404).json({ success: false, message: "Project URL not found!" });

        const isMultiLink =
            String(projectUrl.Project_Link_Type || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'multilink';

        if (isMultiLink) {
            const quotaNum = parseInt(quota, 10);
            if (quota === undefined || quota === null || quota === '' || isNaN(quotaNum) || quotaNum < 1) {
                return res.status(400).json({
                    success: false,
                    message: "quota is required and must be a positive number for Multi Link projects!"
                });
            }
        }

        const result = await SupplierMapping.create({
            partnerid,
            partner_code: partner.code,
            partner_name: partner.name,
            projectid,
            projectUrlId,
            quota, CPI,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL,
            status, IsTest,
            action_by: req.user?.id || null,
            isMultiLink
        });

        return res.status(201).json({
            success: true,
            message: "Supplier mapping added successfully!",
            data: result
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? "Server error!" : error.message,
            error: error.message
        });
    }
};
export const toggleSupplierIsTest = async (req, res) => {
    try {
        const { id } = req.params;
        const { IsTest } = req.body; // expects 1 (Test) or 0 (Live)

        if (![0, 1].includes(Number(IsTest))) {
            return res.status(400).json({ success: false, message: "IsTest must be 0 (Live) or 1 (Test)!" });
        }

        const mapping = await SupplierMapping.getById(id);
        if (!mapping) return res.status(404).json({ success: false, message: "Supplier mapping not found!" });

        await SupplierMapping.toggleIsTest(id, Number(IsTest));

        return res.status(200).json({
            success: true,
            message: `Mode switched to ${Number(IsTest) === 1 ? 'Test' : 'Live'}!`
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllSupplierMappings = async (req, res) => {
    try {
        const { page, limit, search, status, projectid, partnerid } = req.query;
        const result = await SupplierMapping.getAll({ page, limit, search, status, projectid, partnerid });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSupplierMappingById = async (req, res) => {
    try {
        const { id } = req.params;
        const mapping = await SupplierMapping.getById(id);
        if (!mapping) return res.status(404).json({ success: false, message: "Supplier mapping not found!" });
        return res.status(200).json({ success: true, data: mapping });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSupplierMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const mapping = await SupplierMapping.getById(id);
        if (!mapping) return res.status(404).json({ success: false, message: "Supplier mapping not found!" });

        const updateData = { ...req.body };
        delete updateData.linksToAssign;
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        const nextPartnerId = updateData.partnerid !== undefined ? updateData.partnerid : mapping.partnerid;
        const nextProjectId = updateData.projectid !== undefined ? updateData.projectid : mapping.projectid;
        const nextProjectUrlId = updateData.projectUrlId !== undefined ? updateData.projectUrlId : mapping.projectUrlId;

        const project = await Project.getById(nextProjectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const projectUrl = await ProjectUrl.getById(nextProjectUrlId);
        if (!projectUrl) return res.status(404).json({ success: false, message: "Project URL not found!" });

        const isMultiLink =
            String(projectUrl.Project_Link_Type || '').trim().toLowerCase().replace(/[\s_-]+/g, '') === 'multilink';

        let partner_name = null;
        const partnerOrQuotaChanging =
            updateData.partnerid !== undefined ||
            updateData.quota !== undefined ||
            updateData.projectid !== undefined;

        if (isMultiLink && partnerOrQuotaChanging) {
            const nextQuota = updateData.quota !== undefined
                ? parseInt(updateData.quota, 10)
                : parseInt(mapping.quota, 10);
            if (isNaN(nextQuota) || nextQuota < 1) {
                return res.status(400).json({
                    success: false,
                    message: "quota is required and must be a positive number for Multi Link projects!"
                });
            }
            updateData.quota = nextQuota;

            const partner = await Partner.getById(nextPartnerId);
            if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });
            partner_name = partner.name;
            updateData.partner_code = partner.code;
        }

        const result = await SupplierMapping.update(id, updateData, { partner_name, isMultiLink });

        return res.status(200).json({
            success: true,
            message: "Supplier mapping updated successfully!",
            data: result
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: statusCode === 500 ? "Server error!" : error.message,
            error: error.message
        });
    }
};

export const toggleSupplierMappingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        }

        const mapping = await SupplierMapping.getById(id);
        if (!mapping) return res.status(404).json({ success: false, message: "Supplier mapping not found!" });

        await SupplierMapping.toggleStatus(id, status);

        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteSupplierMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const mapping = await SupplierMapping.getById(id);
        if (!mapping) return res.status(404).json({ success: false, message: "Supplier mapping not found!" });

        await SupplierMapping.delete(id);

        return res.status(200).json({ success: true, message: "Supplier mapping deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// Respondent-facing redirect — public, no auth
export const handleSupplierRedirect = async (req, res) => {
    try {
        const { hash } = req.params;
        const { uid } = req.query;

        const mapping = await SupplierMapping.getByDynamicHash(hash);

        if (!mapping) {
            return res.status(404).send('Invalid or expired survey link!');
        }

        if (mapping.status !== 'active') {
            return res.redirect(mapping.TerminateURL || '/inactive');
        }

        // Token se startDate / endDate check (agar present ho)
        const startDate = mapping.tokenData?.startDate;
        const endDate = mapping.tokenData?.endDate;
        if (startDate || endDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (startDate && new Date(startDate) > today) {
                return res.status(403).send('Survey has not started yet!');
            }
            if (endDate && new Date(endDate) < today) {
                return res.redirect(mapping.SurveyCloseURL || '/closed');
            }
        }

        const targetLink = mapping.IsTest
            ? mapping.Test_Link
            : (mapping.link_mode === 'live' ? mapping.Live_Link : mapping.Test_Link);

        if (!targetLink) {
            return res.status(400).send('No survey link configured!');
        }

        const finalUrl = targetLink.includes('?')
            ? `${targetLink}&respondent_id=${uid || ''}`
            : `${targetLink}?respondent_id=${uid || ''}`;

        return res.redirect(finalUrl);
    } catch (error) {
        return res.status(500).send('Server error!');
    }
};
