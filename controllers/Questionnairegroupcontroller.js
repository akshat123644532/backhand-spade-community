import QuestionnaireGroup from '../models/questionnaireGroupModel.js';

export const addQuestionnaireGroup = async (req, res) => {
    try {
        const { group_title, language, status, question_library_ids } = req.body;

        if (!group_title || !language) {
            return res.status(400).json({ success: false, message: "Group title and language are required!" });
        }

        const questionnaire_group_id = await QuestionnaireGroup.create({ group_title, language, status });

        if (question_library_ids && question_library_ids.length > 0) {
            await QuestionnaireGroup.addQuestions(questionnaire_group_id, question_library_ids);
        }

        return res.status(201).json({
            success: true,
            message: "Questionnaire group added successfully!",
            data: { id: questionnaire_group_id, group_title, language }
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
        const { group_title, language, status, question_library_ids } = req.body;

        const group = await QuestionnaireGroup.getById(id);
        if (!group) return res.status(404).json({ success: false, message: "Questionnaire group not found!" });

        const updateData = {};
        if (group_title) updateData.group_title = group_title;
        if (language) updateData.language = language;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length > 0) await QuestionnaireGroup.update(id, updateData);

        if (question_library_ids && question_library_ids.length > 0) {
            await QuestionnaireGroup.deleteQuestions(id);
            await QuestionnaireGroup.addQuestions(id, question_library_ids);
        }

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
