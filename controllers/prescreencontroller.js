import Prescreen from '../models/prescreenModel.js';

export const addPrescreen = async (req, res) => {
    try {
        const { language, question_title, question_type, options, right_answer, status, sort_order } = req.body;

        if (!language || !question_title) {
            return res.status(400).json({ success: false, message: "Language and question title are required!" });
        }
        if (!question_type) {
            return res.status(400).json({ success: false, message: "Question type is required!" });
        }

        const prescreen_id = await Prescreen.create({ language, question_title, question_type, right_answer, status, sort_order });

        if (options && options.length > 0) {
            await Prescreen.addOptions(prescreen_id, options);
        }

        return res.status(201).json({
            success: true,
            message: "Prescreen added successfully!",
            data: { id: prescreen_id, question_title, language, question_type }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllPrescreens = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const language = req.query.language || '';

        const result = await Prescreen.getAll({ page, limit, search, status, language });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPrescreenById = async (req, res) => {
    try {
        const { id } = req.params;
        const prescreen = await Prescreen.getById(id);
        if (!prescreen) return res.status(404).json({ success: false, message: "Prescreen not found!" });
        return res.status(200).json({ success: true, data: prescreen });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getByLanguage = async (req, res) => {
    try {
        const { language } = req.params;
        const prescreens = await Prescreen.getByLanguage(language);
        return res.status(200).json({ success: true, count: prescreens.length, data: prescreens });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePrescreen = async (req, res) => {
    try {
        const { id } = req.params;
        const { language, question_title, question_type, options, right_answer, status, sort_order } = req.body;

        const prescreen = await Prescreen.getById(id);
        if (!prescreen) return res.status(404).json({ success: false, message: "Prescreen not found!" });

        const updateData = {};
        if (language) updateData.language = language;
        if (question_title) updateData.question_title = question_title;
        if (question_type) updateData.question_type = question_type;
        if (right_answer) updateData.right_answer = right_answer;
        if (status) updateData.status = status;
        if (sort_order !== undefined) updateData.sort_order = sort_order;

        if (Object.keys(updateData).length > 0) await Prescreen.update(id, updateData);

        if (options && options.length > 0) {
            await Prescreen.deleteOptions(id);
            await Prescreen.addOptions(id, options);
        }

        return res.status(200).json({ success: true, message: "Prescreen updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSortOrder = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "Items array is required!" });
        }
        await Prescreen.updateSortOrder(items);
        return res.status(200).json({ success: true, message: "Sort order updated successfully!" });
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
        const prescreen = await Prescreen.getById(id);
        if (!prescreen) return res.status(404).json({ success: false, message: "Prescreen not found!" });
        await Prescreen.toggleStatus(id, status);
        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deletePrescreen = async (req, res) => {
    try {
        const { id } = req.params;
        const prescreen = await Prescreen.getById(id);
        if (!prescreen) return res.status(404).json({ success: false, message: "Prescreen not found!" });
        await Prescreen.delete(id);
        return res.status(200).json({ success: true, message: "Prescreen deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};