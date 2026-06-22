import SystemEmail from '../models/systemEmailModel.js';
import { logActivity } from '../utils/activityLogger.js';

// ─── LIST ALL ──────────────────────────────────────────────────────
export const getAllSystemEmails = async (req, res) => {
    try {
        const emails = await SystemEmail.getAll();
        return res.status(200).json({ success: true, data: emails });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── GET ONE ───────────────────────────────────────────────────────
export const getSystemEmailById = async (req, res) => {
    try {
        const { id } = req.params;
        const email = await SystemEmail.getById(id);
        if (!email) {
            return res.status(404).json({ success: false, message: "System email not found!" });
        }
        return res.status(200).json({ success: true, data: email });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── UPDATE ────────────────────────────────────────────────────────
export const updateSystemEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, system_email, content } = req.body;

        const existing = await SystemEmail.getById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "System email not found!" });
        }

        const updateData = {};
        if (name !== undefined)         updateData.name         = name;
        if (system_email !== undefined) updateData.system_email = system_email;
        if (content !== undefined)      updateData.content      = content;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        await SystemEmail.update(id, updateData);

        await logActivity({
            admin_id: req.user?.id,
            action: 'UPDATE',
            module: 'SystemEmail',
            description: `System email "${existing.name}" updated`,
            ip_address: req.ip
        });

        const updated = await SystemEmail.getById(id);
        return res.status(200).json({ success: true, message: "System email updated successfully!", data: updated });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─── DELETE ────────────────────────────────────────────────────────
export const deleteSystemEmail = async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await SystemEmail.getById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "System email not found!" });
        }

        await SystemEmail.delete(id);

        await logActivity({
            admin_id: req.user?.id,
            action: 'DELETE',
            module: 'SystemEmail',
            description: `System email "${existing.name}" deleted`,
            ip_address: req.ip
        });

        return res.status(200).json({ success: true, message: "System email deleted successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};