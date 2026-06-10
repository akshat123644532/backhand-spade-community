import SurveyGroup from '../models/surveyGroupModel.js';

export const addSurveyGroup = async (req, res) => {
    try {
        const { survey_title, language, status, questions } = req.body;

        if (!survey_title || !language) {
            return res.status(400).json({ success: false, message: "Survey title and language are required!" });
        }

        const survey_group_id = await SurveyGroup.create({ survey_title, language, status });

        if (questions && questions.length > 0) {
            await SurveyGroup.addQuestions(survey_group_id, questions);
        }

        return res.status(201).json({
            success: true,
            message: "Survey group added successfully!",
            data: { id: survey_group_id, survey_title, language }
        });

    } catch (error) {
        console.error("ADD SURVEY GROUP ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllSurveyGroups = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';

        const result = await SurveyGroup.getAll({ page, limit, search, status, language });

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSurveyGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await SurveyGroup.getById(id);

        if (!group) {
            return res.status(404).json({ success: false, message: "Survey group not found!" });
        }

        return res.status(200).json({ success: true, data: group });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSurveyGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { survey_title, language, status, questions } = req.body;

        const group = await SurveyGroup.getById(id);
        if (!group) {
            return res.status(404).json({ success: false, message: "Survey group not found!" });
        }

        const updateData = {};
        if (survey_title) updateData.survey_title = survey_title;
        if (language) updateData.language = language;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length > 0) {
            await SurveyGroup.update(id, updateData);
        }

        if (questions && questions.length > 0) {
            await SurveyGroup.deleteQuestions(id);
            await SurveyGroup.addQuestions(id, questions);
        }

        return res.status(200).json({ success: true, message: "Survey group updated successfully!" });
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

        const group = await SurveyGroup.getById(id);
        if (!group) {
            return res.status(404).json({ success: false, message: "Survey group not found!" });
        }

        await SurveyGroup.toggleStatus(id, status);

        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteSurveyGroup = async (req, res) => {
    try {
        const { id } = req.params;

        const group = await SurveyGroup.getById(id);
        if (!group) {
            return res.status(404).json({ success: false, message: "Survey group not found!" });
        }

        await SurveyGroup.delete(id);

        return res.status(200).json({ success: true, message: "Survey group deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};