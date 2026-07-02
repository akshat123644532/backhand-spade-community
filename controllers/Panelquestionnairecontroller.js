import PanelQuestionnaire from '../models/Panelquestionnairemodel.js';

export const addPanelQuestion = async (req, res) => {
    try {
        const { language, question_title, question_text, question_type, options, is_required, sort_order, status } = req.body;

        if (!language || !question_title || !question_text || !question_type) {
            return res.status(400).json({ success: false, message: "Language, question title, question text and question type are required!" });
        }

        const question_id = await PanelQuestionnaire.create({ language, question_title, question_text, question_type, options, is_required, sort_order, status });

        return res.status(201).json({
            success: true,
            message: "Question added successfully!",
            data: { id: question_id, question_title, language, question_type, options: options || [] }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllPanelQuestions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';

        const result = await PanelQuestionnaire.getAll({ page, limit, search, status, language });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPanelQuestionById = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await PanelQuestionnaire.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found!" });
        return res.status(200).json({ success: true, data: question });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPanelQuestionsByTitle = async (req, res) => {
    try {
        const { question_title } = req.params;
        const data = await PanelQuestionnaire.getByTitle(decodeURIComponent(question_title));
        if (!data) return res.status(404).json({ success: false, message: "No questions found for this title!" });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPanelQuestionsByLanguage = async (req, res) => {
    try {
        const { language } = req.params;
        const data = await PanelQuestionnaire.getByLanguage(language);
        if (!data.length) return res.status(404).json({ success: false, message: "No questions found for this language!" });
        return res.status(200).json({ success: true, count: data.length, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePanelQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { language, question_title, question_text, question_type, options, is_required, sort_order, status } = req.body;

        const question = await PanelQuestionnaire.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found!" });

        const updateData = {};
        if (language) updateData.language = language;
        if (question_title) updateData.question_title = question_title;
        if (question_text) updateData.question_text = question_text;
        if (question_type) updateData.question_type = question_type;
        if (options) updateData.options = options;
        if (is_required !== undefined) updateData.is_required = is_required;
        if (sort_order !== undefined) updateData.sort_order = sort_order;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length > 0) await PanelQuestionnaire.update(id, updateData);

        return res.status(200).json({ success: true, message: "Question updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePanelQuestionSortOrder = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Items array is required!" });
        }
        await PanelQuestionnaire.updateSortOrder(items);
        return res.status(200).json({ success: true, message: "Sort order updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const togglePanelQuestionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        }
        const question = await PanelQuestionnaire.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found!" });
        await PanelQuestionnaire.toggleStatus(id, status);
        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deletePanelQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await PanelQuestionnaire.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found!" });
        await PanelQuestionnaire.delete(id);
        return res.status(200).json({ success: true, message: "Question deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};