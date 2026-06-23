import PrescreenSurvey from '../models/prescreenSurveyModel.js';

export const addPrescreenSurvey = async (req, res) => {
    try {
        const { survey_title, language, status, prescreen_ids } = req.body;

        if (!survey_title || !language) {
            return res.status(400).json({ success: false, message: "Survey title and language are required!" });
        }

        const prescreen_survey_id = await PrescreenSurvey.create({ survey_title, language, status });

        if (prescreen_ids && prescreen_ids.length > 0) {
            await PrescreenSurvey.addQuestions(prescreen_survey_id, prescreen_ids);
        }

        return res.status(201).json({
            success: true,
            message: "Prescreen survey added successfully!",
            data: { id: prescreen_survey_id, survey_title, language }
        });

    } catch (error) {
        console.error("ADD PRESCREEN SURVEY ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllPrescreenSurveys = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';

        const result = await PrescreenSurvey.getAll({ page, limit, search, status, language });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPrescreenSurveyById = async (req, res) => {
    try {
        const { id } = req.params;
        const survey = await PrescreenSurvey.getById(id);
        if (!survey) return res.status(404).json({ success: false, message: "Prescreen survey not found!" });
        return res.status(200).json({ success: true, data: survey });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePrescreenSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        const { survey_title, language, status, prescreen_ids } = req.body;

        const survey = await PrescreenSurvey.getById(id);
        if (!survey) return res.status(404).json({ success: false, message: "Prescreen survey not found!" });

        const updateData = {};
        if (survey_title) updateData.survey_title = survey_title;
        if (language) updateData.language = language;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length > 0) await PrescreenSurvey.update(id, updateData);

        if (prescreen_ids && prescreen_ids.length > 0) {
            await PrescreenSurvey.deleteQuestions(id);
            await PrescreenSurvey.addQuestions(id, prescreen_ids);
        }

        return res.status(200).json({ success: true, message: "Prescreen survey updated successfully!" });
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
        const survey = await PrescreenSurvey.getById(id);
        if (!survey) return res.status(404).json({ success: false, message: "Prescreen survey not found!" });
        await PrescreenSurvey.toggleStatus(id, status);
        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deletePrescreenSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        const survey = await PrescreenSurvey.getById(id);
        if (!survey) return res.status(404).json({ success: false, message: "Prescreen survey not found!" });
        await PrescreenSurvey.delete(id);
        return res.status(200).json({ success: true, message: "Prescreen survey deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};