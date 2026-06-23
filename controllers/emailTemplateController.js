import EmailTemplate from '../models/emailTemplateModel.js';
import { logActivity } from '../utils/activityLogger.js';

// ─── LIST ALL TEMPLATES ────────────────────────────────────────────
export const getAllEmailTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.getAll();
        return res.status(200).json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── GET ONE TEMPLATE ──────────────────────────────────────────────
export const getEmailTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await EmailTemplate.getById(id);
        if (!template) {
            return res.status(404).json({ success: false, message: "Email template not found!" });
        }
        return res.status(200).json({ success: true, data: template });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── UPDATE TEMPLATE ───────────────────────────────────────────────
export const updateEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subject, content } = req.body;

        const existing = await EmailTemplate.getById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Email template not found!" });
        }

        const updateData = {};
        if (title !== undefined)   updateData.title   = title;
        if (subject !== undefined) updateData.subject = subject;
        if (content !== undefined) updateData.content = content;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        await EmailTemplate.update(id, updateData);

        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'EmailTemplate',
            description: `Email template "${existing.title}" updated`,
            ip_address: req.ip
        });

        const updated = await EmailTemplate.getById(id);
        return res.status(200).json({ success: true, message: "Email template updated successfully!", data: updated });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── UPDATE STATUS ─────────────────────────────────────────────────
export const updateEmailTemplateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ['active', 'inactive'];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status! Allowed values: ${allowedStatuses.join(', ')}`
            });
        }

        const existing = await EmailTemplate.getById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Email template not found!" });
        }

        if (existing.status === status) {
            return res.status(400).json({ success: false, message: `Template is already ${status}!` });
        }

        await EmailTemplate.updateStatus(id, status);

        await logActivity({
            admin_id: req.user?.id,
            action: 'STATUS_UPDATE',
            module: 'EmailTemplate',
            description: `Email template "${existing.title}" status changed to "${status}"`,
            ip_address: req.ip
        });

        const updated = await EmailTemplate.getById(id);
        return res.status(200).json({ success: true, message: `Email template status updated to "${status}"!`, data: updated });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── DELETE TEMPLATE ───────────────────────────────────────────────
export const deleteEmailTemplate = async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await EmailTemplate.getById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Email template not found!" });
        }

        await EmailTemplate.delete(id);

        await logActivity({
            admin_id: req.user?.id,
            action: 'DELETE',
            module: 'EmailTemplate',
            description: `Email template "${existing.title}" deleted`,
            ip_address: req.ip
        });

        return res.status(200).json({ success: true, message: "Email template deleted successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};