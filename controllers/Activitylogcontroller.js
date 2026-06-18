import ActivityLog from '../models/activityLogModel.js';

export const getAllActivityLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const module = req.query.module || '';

        const result = await ActivityLog.getAll({ page, limit, search, module });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteActivityLog = async (req, res) => {
    try {
        const { id } = req.params;
        await ActivityLog.delete(id);
        return res.status(200).json({ success: true, message: "Activity log deleted!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteAllActivityLogs = async (req, res) => {
    try {
        await ActivityLog.deleteAll();
        return res.status(200).json({ success: true, message: "All activity logs deleted!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};