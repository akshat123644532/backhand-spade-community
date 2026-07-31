import SupplierMapping from '../models/supplierMappingModel.js';
import Partner from '../models/partnerModel.js';
import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';

export const addSupplierMapping = async (req, res) => {
    try {
        const {
            partnerid, projectid, projectUrlId, quota, CPI,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL, VenderURL,
            status, IsTest
        } = req.body;

        if (!partnerid || !projectid || !projectUrlId) {
            return res.status(400).json({ success: false, message: "partnerid, projectid and projectUrlId are required!" });
        }

        const partner = await Partner.getById(partnerid);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });

        const project = await Project.getById(projectid);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const projectUrl = await ProjectUrl.getById(projectUrlId);
        if (!projectUrl) return res.status(404).json({ success: false, message: "Project URL not found!" });

        const result = await SupplierMapping.create({
            partnerid,
            partner_code: partner.code,
            projectid,
            projectUrlId,
            quota, CPI,
            CompleteURL, TerminateURL, OverQuotaURL, QualityTermURL, SurveyCloseURL, VenderURL,
            status, IsTest,
            action_by: req.user?.id || null
        });

        return res.status(201).json({
            success: true,
            message: "Supplier mapping added successfully!",
            data: result
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
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        await SupplierMapping.update(id, updateData);

        return res.status(200).json({ success: true, message: "Supplier mapping updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
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