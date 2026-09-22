import ApiKey from '../models/apiKeyModel.js';
import { logActivity } from '../utils/activityLogger.js';

const maskApiKey = (apiKey) => {
    if (!apiKey) return null;

    const key = String(apiKey);

    if (key.length <= 4) {
        return '****';
    }

    return `${'*'.repeat(Math.max(4, key.length - 4))}${key.slice(-4)}`;
};

const sanitizeApiKey = (item) => {
    if (!item) return item;

    return {
        ...item,
        api_key: maskApiKey(item.api_key)
    };
};

export const createApiKey = async (req, res) => {
    try {
        const {
            api_name,
            api_label,
            api_user_id,
            api_key,
            base_url,
            endpoint,
            method,
            auth_type,
            header_name,
            status,
            description
        } = req.body;

        if (!api_name || !api_label || !api_key) {
            return res.status(400).json({
                success: false,
                message: 'api_name, api_label and api_key are required'
            });
        }

        const result = await ApiKey.create({
            api_name,
            api_label,
            api_user_id,
            api_key,
            base_url,
            endpoint,
            method,
            auth_type,
            header_name,
            status,
            description
        });

        await logActivity({
            admin_id: req.user?.id,
            action: 'CREATE',
            module: 'API Key',
            description: `API configuration "${api_name}" created`,
            ip_address: req.ip
        });

        return res.status(201).json({
            success: true,
            message: 'API configuration created successfully',
            data: {
                id: result.insertId
            }
        });
    } catch (error) {
        console.error('Create API Key Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create API configuration',
            error: error.message
        });
    }
};

export const getAllApiKeys = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = ''
        } = req.query;

        const result = await ApiKey.getAll({
            page,
            limit,
            search,
            status
        });

        result.data = result.data.map(sanitizeApiKey);

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get API Keys Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch API configurations',
            error: error.message
        });
    }
};

export const getApiKeyById = async (req, res) => {
    try {
        const { id } = req.params;

        const apiKey = await ApiKey.getById(id);

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'API configuration not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: sanitizeApiKey(apiKey)
        });
    } catch (error) {
        console.error('Get API Key Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch API configuration',
            error: error.message
        });
    }
};

export const updateApiKey = async (req, res) => {
    try {
        const { id } = req.params;

        const existingApiKey = await ApiKey.getById(id);

        if (!existingApiKey) {
            return res.status(404).json({
                success: false,
                message: 'API configuration not found'
            });
        }

        const updateData = { ...req.body };

        if (
            updateData.api_key === undefined ||
            updateData.api_key === null ||
            updateData.api_key === '' ||
            updateData.api_key.startsWith('****')
        ) {
            delete updateData.api_key;
        }

        const result = await ApiKey.update(id, updateData);

        if (!result) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'API Key',
            description: `API configuration ID ${id} updated`,
            ip_address: req.ip
        });

        return res.status(200).json({
            success: true,
            message: 'API configuration updated successfully'
        });
    } catch (error) {
        console.error('Update API Key Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update API configuration',
            error: error.message
        });
    }
};

export const deleteApiKey = async (req, res) => {
    try {
        const { id } = req.params;

        const existingApiKey = await ApiKey.getById(id);

        if (!existingApiKey) {
            return res.status(404).json({
                success: false,
                message: 'API configuration not found'
            });
        }

        await ApiKey.delete(id);

        await logActivity({
            admin_id: req.user?.id,
            action: 'DELETE',
            module: 'API Key',
            description: `API configuration ID ${id} deleted`,
            ip_address: req.ip
        });

        return res.status(200).json({
            success: true,
            message: 'API configuration deleted successfully'
        });
    } catch (error) {
        console.error('Delete API Key Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete API configuration',
            error: error.message
        });
    }
};

export const updateApiKeyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be active or inactive'
            });
        }

        const existingApiKey = await ApiKey.getById(id);

        if (!existingApiKey) {
            return res.status(404).json({
                success: false,
                message: 'API configuration not found'
            });
        }

        await ApiKey.updateStatus(id, status);

        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'API Key',
            description: `API configuration ID ${id} status changed to ${status}`,
            ip_address: req.ip
        });

        return res.status(200).json({
            success: true,
            message: 'API status updated successfully'
        });
    } catch (error) {
        console.error('Update API Key Status Error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update API status',
            error: error.message
        });
    }
};