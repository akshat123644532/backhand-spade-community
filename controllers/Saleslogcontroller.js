import SalesLog from '../models/salesLogModel.js';
import SalesProject from '../models/salesProjectModel.js';

const VALID_COMMENT_BY = ['Sales', 'Client', 'Manager', 'Other'];


export const addSalesLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { email_subject, comment, comment_by } = req.body;

        if (!comment) {
            return res.status(400).json({ success: false, message: "Comment is required!" });
        }

        if (comment_by && !VALID_COMMENT_BY.includes(comment_by)) {
            return res.status(400).json({ success: false, message: "comment_by must be Sales, Client, Manager or Other!" });
        }

        // Sales project exist karta hai?
        const project = await SalesProject.getById(id);
        if (!project) {
            return res.status(404).json({ success: false, message: "Sales project not found!" });
        }

        await SalesLog.create({
            project_id: project.project_id,
            email_subject,
            comment,
            comment_by: comment_by || 'Sales',
            created_by: req.user?.id || null
        });

        return res.status(201).json({ success: true, message: "Log added successfully!" });

    } catch (error) {
        console.error("ADD SALES LOG ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSalesLogs = async (req, res) => {
    try {
        const { id } = req.params;

        const project = await SalesProject.getById(id);
        if (!project) {
            return res.status(404).json({ success: false, message: "Sales project not found!" });
        }

        const logs = await SalesLog.getByProjectId(project.project_id);

        return res.status(200).json({ success: true, data: logs });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};


// ─────────────────────────────────────────────
export const updateSalesLog = async (req, res) => {
    try {
        const { logId } = req.params;
        const { email_subject, comment, comment_by } = req.body;

        if (comment_by && !VALID_COMMENT_BY.includes(comment_by)) {
            return res.status(400).json({ success: false, message: "comment_by must be Sales, Client, Manager or Other!" });
        }

        const log = await SalesLog.getById(logId);
        if (!log) {
            return res.status(404).json({ success: false, message: "Log not found!" });
        }

        await SalesLog.update(logId, { email_subject, comment, comment_by });

        return res.status(200).json({ success: true, message: "Log updated successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─────────────────────────────────────────────
// DELETE LOG
// DELETE /api/admin/sales/project/:id/log/:logId
// ─────────────────────────────────────────────
export const deleteSalesLog = async (req, res) => {
    try {
        const { logId } = req.params;

        const log = await SalesLog.getById(logId);
        if (!log) {
            return res.status(404).json({ success: false, message: "Log not found!" });
        }

        await SalesLog.delete(logId);

        return res.status(200).json({ success: true, message: "Log deleted successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};