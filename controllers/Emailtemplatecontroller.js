import EmailTemplate from '../models/emailTemplateModel.js';
import { logActivity } from '../utils/activityLogger.js';

// ─── LIST ALL TEMPLATES (title only) ──────────────────────────────
export const getAllEmailTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.getAll();
        return res.status(200).json({ success: true, data: templates });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── GET ONE TEMPLATE (for edit) ──────────────────────────────────
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
        if (title !== undefined) updateData.title = title;
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