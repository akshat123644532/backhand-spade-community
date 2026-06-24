import HomePageSetting from '../models/homePageModel.js';

// GET all sections
export const getAllSettings = async (req, res) => {
    try {
        const data = await HomePageSetting.getAll();
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// GET single section
export const getSectionSetting = async (req, res) => {
    try {
        const { section } = req.params;
        const data = await HomePageSetting.getBySection(section);
        if (!data) return res.status(404).json({ success: false, message: "Section not found!" });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// POST/PUT - upsert any section with any fields (fully dynamic)
export const upsertSection = async (req, res) => {
    try {
        const { section } = req.params;
        const fields = req.body;

        if (!section) {
            return res.status(400).json({ success: false, message: "Section is required!" });
        }
        if (!fields || Object.keys(fields).length === 0) {
            return res.status(400).json({ success: false, message: "At least one field is required!" });
        }

        await HomePageSetting.upsertSection(section, fields);
        return res.status(200).json({ success: true, message: `${section} updated successfully!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// DELETE entire section
export const deleteSection = async (req, res) => {
    try {
        const { section } = req.params;
        await HomePageSetting.deleteSection(section);
        return res.status(200).json({ success: true, message: `${section} deleted successfully!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// DELETE single field from section
export const deleteField = async (req, res) => {
    try {
        const { section, field_key } = req.params;
        await HomePageSetting.deleteField(section, field_key);
        return res.status(200).json({ success: true, message: `Field ${field_key} deleted successfully!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};