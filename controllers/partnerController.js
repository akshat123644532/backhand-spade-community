import Partner from '../models/partnerModel.js';
import { logActivity } from '../utils/activityLogger.js';
import { decrypt, encrypt } from '../utils/cryptoHelper.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';
const prepareApiSecretKeyForStorage = (apiSecretKey) => {
    if (apiSecretKey === undefined || apiSecretKey === null || apiSecretKey === '') {
        return apiSecretKey;
    }
    const plainSecret = decrypt(apiSecretKey);
    return encrypt(plainSecret);
};

const withDecryptedApiSecret = (partner) => {
    if (!partner?.api_secret_key) return partner;
    try {
        return {
            ...partner,
            api_secret_key: decrypt(partner.api_secret_key),
        };
    } catch (error) {
        return partner;
    }
};

export const addPartner = async (req, res) => {
    try {
        const {
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            status, api_base_url, api_body, api_secret_key
        } = req.body;
        if (!name || !email) return res.status(400).json({ success: false, message: "Name and email are required!" });
        if (panel_size === undefined || panel_size === null || panel_size === '') {
            return res.status(400).json({ success: false, message: "Panel size is required!" });
        }
        if (isNaN(Number(panel_size)) || Number(panel_size) < 0) {
            return res.status(400).json({ success: false, message: "Panel size must be a valid number!" });
        }

        const emailExists = await Partner.findByEmail(email);
        if (emailExists) return res.status(400).json({ success: false, message: "Partner with this email already exists!" });

        const code = await Partner.generateCode();
        const codeExists = await Partner.findByCode(code);
        if (codeExists) return res.status(400).json({ success: false, message: "Code conflict, please try again!" });

        const encryptedApiSecretKey = api_secret_key
            ? prepareApiSecretKeyForStorage(api_secret_key)
            : api_secret_key;

        await Partner.create({
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            code, status, api_base_url, api_body, api_secret_key: encryptedApiSecretKey
        });

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

export const getPartnerPanelSizes = async (req, res) => {
    try {
        const partners = await Partner.getAllPanelSizes();
        return res.status(200).json({
            success: true,
            data: partners.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                panel_size: Number(p.panel_size) || 0
            }))
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPartnerById = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });
        return res.status(200).json({ success: true, data: withDecryptedApiSecret(partner) });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            status, api_base_url, api_body, api_secret_key
        } = req.body;

        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });

        if (email && email !== partner.email) {
            const emailExists = await Partner.findByEmail(email);
            if (emailExists) return res.status(400).json({ success: false, message: "Email already in use!" });
        }

        const updateData = {
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            status, api_base_url, api_body, api_secret_key
        };
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        if (Object.prototype.hasOwnProperty.call(updateData, 'api_secret_key') && updateData.api_secret_key) {
            updateData.api_secret_key = prepareApiSecretKeyForStorage(updateData.api_secret_key);
        }

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
export const exportPartnersCsv = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const country = req.query.country || '';
        const result = await Partner.getAll({ page: 1, limit: 1000000, search, status, country });

        const csv = buildCsv(result.data, [
            { label: 'ID', key: 'id' },
            { label: 'Code', key: 'code' },
            { label: 'Name', key: 'name' },
            { label: 'Email', key: 'email' },
            { label: 'Contact Person', key: 'contact_person' },
            { label: 'Country', key: 'country' },
            { label: 'Panel Size', key: 'panel_size' },
            { label: 'Status', key: 'status' }
        ]);

        return sendCsv(res, 'partners.csv', csv);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
