import ApiIntegration from '../models/apiIntegrationModel.js';
import Admin from '../models/adminModel.js';
import { logActivity } from '../utils/activityLogger.js';

async function assertCanManageApiKeys(req) {
    if (!req.user?.id) {
        return { ok: false, status: 401, message: 'Unauthorized!' };
    }

    const admin = await Admin.getById(req.user.id);
    if (!admin || String(admin.status ?? '').toLowerCase() !== 'active') {
        return {
            ok: false,
            status: 403,
            message: 'Only authorized admins can manage API credentials.',
        };
    }

    return { ok: true, admin };
}

export const listApiIntegrations = async (req, res) => {
    try {
        const access = await assertCanManageApiKeys(req);
        if (!access.ok) {
            return res.status(access.status).json({ success: false, message: access.message });
        }

        const data = await ApiIntegration.list({ reveal: false });
        return res.status(200).json({
            success: true,
            message: 'API integrations fetched successfully',
            data,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error!',
            error: error.message,
        });
    }
};

export const getApiIntegrationByName = async (req, res) => {
    try {
        const access = await assertCanManageApiKeys(req);
        if (!access.ok) {
            return res.status(access.status).json({ success: false, message: access.message });
        }

        const reveal = String(req.query.reveal ?? '').toLowerCase() === 'true';
        const record = await ApiIntegration.getByName(req.params.name, { reveal });
        if (!record) {
            return res.status(404).json({ success: false, message: 'API integration not found!' });
        }

        return res.status(200).json({
            success: true,
            message: 'API integration fetched successfully',
            data: record,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error!',
            error: error.message,
        });
    }
};

export const upsertApiIntegration = async (req, res) => {
    try {
        const access = await assertCanManageApiKeys(req);
        if (!access.ok) {
            return res.status(access.status).json({ success: false, message: access.message });
        }

        const { api_name, api_user_id, api_key } = req.body ?? {};
        const name = String(api_name ?? '').trim();
        if (!name) {
            return res.status(400).json({ success: false, message: 'API Name is required!' });
        }

        const updated = await ApiIntegration.upsert({
            api_name: name,
            api_user_id,
            api_key,
        });

        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'API Key Management',
            description: `API credentials updated for ${name}`,
            ip_address: req.ip,
        });

        return res.status(200).json({
            success: true,
            message: 'API credentials saved successfully!',
            data: updated,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error!',
            error: error.message,
        });
    }
};
