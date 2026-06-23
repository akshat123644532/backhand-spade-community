import SalesLog from '../models/salesLogModel.js';
import SalesProject from '../models/salesProjectModel.js';
import { logActivity } from '../utils/activityLogger.js';

const VALID_COMMENT_BY = ['Sales', 'Client', 'Manager', 'Other'];

export const addSalesLog = async (req, res) => {
    try {
        const { id } = req.params;
        const { email_subject, comment, comment_by } = req.body;
        if (!comment) return res.status(400).json({ success: false, message: "Comment is required!" });
        if (comment_by && !VALID_COMMENT_BY.includes(comment_by)) return res.status(400).json({ success: false, message: "comment_by must be Sales, Client, Manager or Other!" });

        const project = await SalesProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Sales project not found!" });

        await SalesLog.create({ project_id: project.project_id, email_subject, comment, comment_by: comment_by || 'Sales', created_by: req.user?.id || null });

        await logActivity({ admin_id: req.user?.id, action: 'ADD', module: 'SalesLog', description: `Log added to sales project ${project.project_id}`, ip_address: req.ip });

        return res.status(201).json({ success: true, message: "Log added successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSalesLogs = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await SalesProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Sales project not found!" });
        const logs = await SalesLog.getByProjectId(project.project_id);
        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSalesLog = async (req, res) => {
    try {
        const { logId } = req.params;
        const { email_subject, comment, comment_by } = req.body;
        if (comment_by && !VALID_COMMENT_BY.includes(comment_by)) return res.status(400).json({ success: false, message: "comment_by must be Sales, Client, Manager or Other!" });

        const log = await SalesLog.getById(logId);
        if (!log) return res.status(404).json({ success: false, message: "Log not found!" });

        await SalesLog.update(logId, { email_subject, comment, comment_by });

        await logActivity({ admin_id: req.user?.id, action: 'UPDATE', module: 'SalesLog', description: `Sales log ID ${logId} updated`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Log updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteSalesLog = async (req, res) => {
    try {
        const { logId } = req.params;
        const log = await SalesLog.getById(logId);
        if (!log) return res.status(404).json({ success: false, message: "Log not found!" });

        await SalesLog.delete(logId);

        await logActivity({ admin_id: req.user?.id, action: 'DELETE', module: 'SalesLog', description: `Sales log ID ${logId} deleted`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Log deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSalesLogById = async (req, res) => {
    try {
        const { logId } = req.params;
        const log = await SalesLog.getById(logId);
        if (!log) return res.status(404).json({ success: false, message: "Log not found!" });
        return res.status(200).json({ success: true, data: log });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};