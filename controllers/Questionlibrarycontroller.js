import QuestionLibrary from '../models/Questionlibrarymodel.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';

const ANSWERABLE_TYPES = ['checkbox', 'radio', 'dropdown'];

const isAnswerableType = (type) => {
    return ANSWERABLE_TYPES.includes(String(type || '').toLowerCase());
};

const stripRightAnswerIfNotAnswerable = (question) => {
    if (!question) return question;

    if (isAnswerableType(question.question_type)) {
        return question;
    }

    const { right_answer, ...rest } = question;
    return rest;
};

// ADD QUESTION
export const addLibraryQuestion = async (req, res) => {
    try {
        const {
            language,
            question_title,
            question_type,
            options,
            right_answer,
            status,
            sort_order
        } = req.body;

        if (!language || !question_title) {
            return res.status(400).json({
                success: false,
                message: "Language and question title are required!"
            });
        }

        if (!question_type) {
            return res.status(400).json({
                success: false,
                message: "Question type is required!"
            });
        }

        const normalizedType = String(question_type).toLowerCase();

        // Sirf checkbox/radio/dropdown ke liye right_answer save hoga
        const finalRightAnswer = isAnswerableType(normalizedType)
            ? (right_answer ?? null)
            : null;

        const question_library_id = await QuestionLibrary.create({
            language,
            question_title,
            question_type: normalizedType,
            options: options || [],
            right_answer: finalRightAnswer,
            status,
            sort_order
        });

        const responseData = stripRightAnswerIfNotAnswerable({
            id: question_library_id,
            question_title,
            language,
            question_type: normalizedType,
            options: options || [],
            right_answer: finalRightAnswer,
            status: status || 'active',
            sort_order: sort_order ?? 0
        });

        return res.status(201).json({
            success: true,
            message: "Question added to library successfully!",
            data: responseData
        });

    } catch (error) {
        console.error("addLibraryQuestion error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// GET ALL
export const getAllLibraryQuestions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';
        const question_type = req.query.question_type || '';

        const result = await QuestionLibrary.getAll({
            page,
            limit,
            search,
            status,
            language,
            question_type
        });

        result.data = result.data.map(stripRightAnswerIfNotAnswerable);

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// GET BY ID
export const getLibraryQuestionById = async (req, res) => {
    try {
        const { id } = req.params;

        const question = await QuestionLibrary.getById(id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found in library!"
            });
        }

        return res.status(200).json({
            success: true,
            data: stripRightAnswerIfNotAnswerable(question)
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// GET BY LANGUAGE
export const getLibraryQuestionsByLanguage = async (req, res) => {
    try {
        const { language } = req.params;

        const questions = await QuestionLibrary.getByLanguage(language);

        const data = questions.map(stripRightAnswerIfNotAnswerable);

        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// UPDATE QUESTION
export const updateLibraryQuestion = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            language,
            question_title,
            question_type,
            options,
            right_answer,
            status,
            sort_order
        } = req.body;

        const question = await QuestionLibrary.getById(id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found in library!"
            });
        }

        const updateData = {};

        if (language !== undefined) {
            updateData.language = language;
        }

        if (question_title !== undefined) {
            updateData.question_title = question_title;
        }

        if (question_type !== undefined) {
            updateData.question_type = String(question_type).toLowerCase();
        }

        if (options !== undefined) {
            updateData.options = options;
        }

        if (status !== undefined) {
            updateData.status = status;
        }

        if (sort_order !== undefined) {
            updateData.sort_order = sort_order;
        }

        // New type diya hai to new type use hoga,
        // warna existing type use hoga.
        const effectiveType = String(
            question_type || question.question_type || ''
        ).toLowerCase();

        // IMPORTANT:
        // Sirf checkbox/radio/dropdown me right_answer allowed hai.
        if (isAnswerableType(effectiveType)) {
            if (right_answer !== undefined) {
                updateData.right_answer = right_answer;
            }
        } else {
            // textbox etc. ke liye hamesha NULL
            updateData.right_answer = null;
        }

        if (Object.keys(updateData).length > 0) {
            await QuestionLibrary.update(id, updateData);
        }

        const updatedQuestion = await QuestionLibrary.getById(id);

        return res.status(200).json({
            success: true,
            message: "Library question updated successfully!",
            data: stripRightAnswerIfNotAnswerable(updatedQuestion)
        });

    } catch (error) {
        console.error("updateLibraryQuestion error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// UPDATE SORT ORDER
export const updateLibraryQuestionSortOrder = async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Items array is required!"
            });
        }

        await QuestionLibrary.updateSortOrder(items);

        return res.status(200).json({
            success: true,
            message: "Sort order updated successfully!"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// TOGGLE STATUS
export const toggleLibraryQuestionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be active or inactive!"
            });
        }

        const question = await QuestionLibrary.getById(id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found in library!"
            });
        }

        await QuestionLibrary.toggleStatus(id, status);

        return res.status(200).json({
            success: true,
            message: `Status updated to ${status}!`
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// DELETE
export const deleteLibraryQuestion = async (req, res) => {
    try {
        const { id } = req.params;

        const question = await QuestionLibrary.getById(id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "Question not found in library!"
            });
        }

        await QuestionLibrary.delete(id);

        return res.status(200).json({
            success: true,
            message: "Question deleted from library successfully!"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// EXPORT CSV
export const exportLibraryQuestionsCsv = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';
        const question_type = req.query.question_type || '';

        const result = await QuestionLibrary.getAll({
            page: 1,
            limit: 1000000,
            search,
            status,
            language,
            question_type
        });

        const csv = buildCsv(result.data, [
            { label: 'ID', key: 'id' },
            { label: 'Language', key: 'language' },
            { label: 'Question Title', key: 'question_title' },
            { label: 'Question Type', key: 'question_type' },
            { label: 'Status', key: 'status' }
        ]);

        return sendCsv(res, 'question_library.csv', csv);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};
