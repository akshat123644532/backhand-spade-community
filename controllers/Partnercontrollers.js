import Partner from '../models/partnerModel.js';
import { logActivity } from '../utils/activityLogger.js';

export const addPartner = async (req, res) => {
    try {
        const { name, email, contact_no, country, contact_person, website_url, panel_size, complete, terminate, over_quota, quality_term, survey_close, about_partner, status } = req.body;
        if (!name || !email) return res.status(400).json({ success: false, message: "Name and email are required!" });

        const emailExists = await Partner.findByEmail(email);
        if (emailExists) return res.status(400).json({ success: false, message: "Partner with this email already exists!" });

        const code = await Partner.generateCode();
        const codeExists = await Partner.findByCode(code);
        if (codeExists) return res.status(400).json({ success: false, message: "Code conflict, please try again!" });

        await Partner.create({ name, email, contact_no, country, contact_person, website_url, panel_size, complete, terminate, over_quota, quality_term, survey_close, about_partner, code, status });

        await logActivity({ admin_id: req.user?.id, action: 'ADD', module: 'Partner', description: `Partner "${name}" added with code ${code}`, ip_address: req.ip });

        return res.status(201).json({ success: true, message: "Partner added successfully!", data: { code, name, email } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllPartners = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const country = req.query.country || '';
        const result = await Partner.getAll({ page, limit, search, status, country });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPartnerById = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });
        return res.status(200).json({ success: true, data: partner });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, contact_no, country, contact_person, website_url, panel_size, complete, terminate, over_quota, quality_term, survey_close, about_partner, status } = req.body;

        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });

        if (email && email !== partner.email) {
            const emailExists = await Partner.findByEmail(email);
            if (emailExists) return res.status(400).json({ success: false, message: "Email already in use!" });
        }

        const updateData = { name, email, contact_no, country, contact_person, website_url, panel_size, complete, terminate, over_quota, quality_term, survey_close, about_partner, status };
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
        await Partner.update(id, updateData);

        await logActivity({ admin_id: req.user?.id, action: 'UPDATE', module: 'Partner', description: `Partner ID ${id} updated`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Partner updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deletePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });

        await Partner.delete(id);

        await logActivity({ admin_id: req.user?.id, action: 'DELETE', module: 'Partner', description: `Partner ID ${id} deleted`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Partner deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};