import SurveyGroupProject from '../models/surveyGroupProjectModel.js';

export const addSurveyGroupProject = async (req, res) => {
    try {
        const { project_name, description, notes, status, client_ids } = req.body;

        if (!project_name) {
            return res.status(400).json({ success: false, message: "Project name is required!" });
        }
        if (!client_ids || client_ids.length === 0) {
            return res.status(400).json({ success: false, message: "At least one client is required!" });
        }

        const project_id = await SurveyGroupProject.create({
            project_name, description, notes, status,
            created_by: req.user?.id || null
        });

        await SurveyGroupProject.addClients(project_id, client_ids);

        return res.status(201).json({
            success: true,
            message: "Survey group project added successfully!",
            data: { id: project_id, project_name }
        });

    } catch (error) {
        console.error("ADD SURVEY GROUP PROJECT ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllSurveyGroupProjects = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const result = await SurveyGroupProject.getAll({ page, limit, search, status });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSurveyGroupProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await SurveyGroupProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });
        return res.status(200).json({ success: true, data: project });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSurveyGroupProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { project_name, description, notes, status, client_ids } = req.body;

        const project = await SurveyGroupProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const updateData = {};
        if (project_name) updateData.project_name = project_name;
        if (description !== undefined) updateData.description = description;
        if (notes !== undefined) updateData.notes = notes;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length > 0) await SurveyGroupProject.update(id, updateData);

        if (client_ids && client_ids.length > 0) {
            await SurveyGroupProject.deleteClients(id);
            await SurveyGroupProject.addClients(id, client_ids);
        }

        return res.status(200).json({ success: true, message: "Project updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        }
        const project = await SurveyGroupProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });
        await SurveyGroupProject.toggleStatus(id, status);
        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteSurveyGroupProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await SurveyGroupProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });
        await SurveyGroupProject.delete(id);
        return res.status(200).json({ success: true, message: "Project deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};