import QuestionLibrary from '../models/questionLibraryModel.js';

export const addLibraryQuestion = async (req, res) => {
    try {
        const { language, question_title, question_type, options, right_answer, status, sort_order } = req.body;

        if (!language || !question_title) {
            return res.status(400).json({ success: false, message: "Language and question title are required!" });
        }
        if (!question_type) {
            return res.status(400).json({ success: false, message: "Question type is required!" });
        }

        const question_library_id = await QuestionLibrary.create({ language, question_title, question_type, right_answer, status, sort_order });

        if (options && options.length > 0) {
            await QuestionLibrary.addOptions(question_library_id, options);
        }

        return res.status(201).json({
            success: true,
            message: "Question added to library successfully!",
            data: { id: question_library_id, question_title, language, question_type }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllLibraryQuestions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';

        const result = await QuestionLibrary.getAll({ page, limit, search, status, language });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getLibraryQuestionById = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await QuestionLibrary.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found in library!" });
        return res.status(200).json({ success: true, data: question });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getLibraryQuestionsByLanguage = async (req, res) => {
    try {
        const { language } = req.params;
        const questions = await QuestionLibrary.getByLanguage(language);
        return res.status(200).json({ success: true, count: questions.length, data: questions });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateLibraryQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { language, question_title, question_type, options, right_answer, status, sort_order } = req.body;

        const question = await QuestionLibrary.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found in library!" });

        const updateData = {};
        if (language) updateData.language = language;
        if (question_title) updateData.question_title = question_title;
        if (question_type) updateData.question_type = question_type;
        if (right_answer) updateData.right_answer = right_answer;
        if (status) updateData.status = status;
        if (sort_order !== undefined) updateData.sort_order = sort_order;

        if (Object.keys(updateData).length > 0) await QuestionLibrary.update(id, updateData);

        if (options && options.length > 0) {
            await QuestionLibrary.deleteOptions(id);
            await QuestionLibrary.addOptions(id, options);
        }

        return res.status(200).json({ success: true, message: "Library question updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateLibraryQuestionSortOrder = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Items array is required!" });
        }
        await QuestionLibrary.updateSortOrder(items);
        return res.status(200).json({ success: true, message: "Sort order updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleLibraryQuestionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        }
        const question = await QuestionLibrary.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found in library!" });
        await QuestionLibrary.toggleStatus(id, status);
        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteLibraryQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const question = await QuestionLibrary.getById(id);
        if (!question) return res.status(404).json({ success: false, message: "Question not found in library!" });
        await QuestionLibrary.delete(id);
        return res.status(200).json({ success: true, message: "Question deleted from library successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};