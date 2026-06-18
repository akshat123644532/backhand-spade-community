import SurveyGroupProject from '../models/surveyGroupProjectModel.js';

export const addSurveyGroupProject = async (req, res) => {
    try {
        const { project_name, description, notes, status, client_ids, survey_ids } = req.body;

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

        if (survey_ids && survey_ids.length > 0) {
            await SurveyGroupProject.addSurveys(project_id, survey_ids);
        }

        const fullProject = await SurveyGroupProject.getById(project_id);

        return res.status(201).json({
            success: true,
            message: "Survey group project added successfully!",
            data: fullProject
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
        const { project_name, description, notes, status, client_ids, survey_ids } = req.body;

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

        if (survey_ids && survey_ids.length > 0) {
            await SurveyGroupProject.deleteSurveys(id);
            await SurveyGroupProject.addSurveys(id, survey_ids);
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

export const addSurveysToGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { survey_ids } = req.body;

        if (!survey_ids || !Array.isArray(survey_ids) || survey_ids.length === 0) {
            return res.status(400).json({ success: false, message: "survey_ids array is required!" });
        }

        const project = await SurveyGroupProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        await SurveyGroupProject.addSurveys(id, survey_ids);

        return res.status(200).json({ success: true, message: `${survey_ids.length} survey(s) added to group!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const removeSurveyFromGroup = async (req, res) => {
    try {
        const { id, surveyId } = req.params;

        const project = await SurveyGroupProject.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        await SurveyGroupProject.removeSurvey(id, surveyId);

        return res.status(200).json({ success: true, message: "Survey removed from group!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};