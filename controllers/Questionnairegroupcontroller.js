import QuestionnaireGroup from '../models/Questionnairegroupmodel.js';

export const addQuestionnaireGroup = async (req, res) => {
    try {
        const { surveyTitle, language, status, questionIds } = req.body;

        if (!surveyTitle || !language) {
            return res.status(400).json({ success: false, message: "Survey title and language are required!" });
        }

        const questionnaire_group_id = await QuestionnaireGroup.create({ surveyTitle, language, status, questionIds });

        return res.status(201).json({
            success: true,
            message: "Questionnaire group added successfully!",
            data: { id: questionnaire_group_id, surveyTitle, language, questionIds: questionIds || [] }
        });

    } catch (error) {
        console.error("ADD QUESTIONNAIRE GROUP ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllQuestionnaireGroups = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';

        const result = await QuestionnaireGroup.getAll({ page, limit, search, status, language });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getQuestionnaireGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await QuestionnaireGroup.getById(id);
        if (!group) return res.status(404).json({ success: false, message: "Questionnaire group not found!" });
        return res.status(200).json({ success: true, data: group });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateQuestionnaireGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { surveyTitle, language, status, questionIds } = req.body;

        const group = await QuestionnaireGroup.getById(id);
        if (!group) return res.status(404).json({ success: false, message: "Questionnaire group not found!" });

        const updateData = {};
        if (surveyTitle) updateData.surveyTitle = surveyTitle;
        if (language) updateData.language = language;
        if (status) updateData.status = status;
        if (questionIds) updateData.questionIds = questionIds;

        if (Object.keys(updateData).length > 0) await QuestionnaireGroup.update(id, updateData);

        return res.status(200).json({ success: true, message: "Questionnaire group updated successfully!" });
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
        const group = await QuestionnaireGroup.getById(id);
        if (!group) return res.status(404).json({ success: false, message: "Questionnaire group not found!" });
        await QuestionnaireGroup.toggleStatus(id, status);
        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteQuestionnaireGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await QuestionnaireGroup.getById(id);
        if (!group) return res.status(404).json({ success: false, message: "Questionnaire group not found!" });
        await QuestionnaireGroup.delete(id);
        return res.status(200).json({ success: true, message: "Questionnaire group deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
