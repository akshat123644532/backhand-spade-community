import Prescreen from '../models/prescreenModel.js';

export const addPrescreen = async (req, res) => {
    try {
        // Yahan 'title' ki jagah 'survey_title' use karein
        const { survey_title, language, status, questions } = req.body;

        // Validation mein bhi 'survey_title' check karein
        if (!survey_title || !language) {
            return res.status(400).json({ success: false, message: "Survey title and language are required!" });
        }

        const prescreen_id = await Prescreen.create({ survey_title, language, status });

        if (questions && questions.length > 0) {
            await Prescreen.addQuestions(prescreen_id, questions);
        }

        return res.status(201).json({
            success: true,
            message: "Prescreen added successfully!",
            data: { id: prescreen_id, survey_title, language }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllPrescreens = async (req, res) => {
    try {
        const { page, limit, search, status, language } = req.query;
        const result = await Prescreen.getAll({ page, limit, search, status, language });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPrescreenById = async (req, res) => {
    try {
        const group = await Prescreen.getById(req.params.id);
        if (!group) return res.status(404).json({ success: false, message: "Prescreen not found!" });
        return res.status(200).json({ success: true, data: group });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePrescreen = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, language, status, questions } = req.body;
        const group = await Prescreen.getById(id);
        if (!group) return res.status(404).json({ success: false, message: "Prescreen not found!" });

        const updateData = {};
        if (title) updateData.title = title;
        if (language) updateData.language = language;
        if (status) updateData.status = status;

        if (Object.keys(updateData).length > 0) await Prescreen.update(id, updateData);
        if (questions && questions.length > 0) {
            await Prescreen.deleteQuestions(id);
            await Prescreen.addQuestions(id, questions);
        }
        return res.status(200).json({ success: true, message: "Prescreen updated!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleStatus = async (req, res) => {
    try {
        await Prescreen.toggleStatus(req.params.id, req.body.status);
        return res.status(200).json({ success: true, message: "Status updated!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deletePrescreen = async (req, res) => {
    try {
        await Prescreen.delete(req.params.id);
        return res.status(200).json({ success: true, message: "Prescreen deleted!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};