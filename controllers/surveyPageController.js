import SurveyPage from '../models/surveyPageModel.js';

export const getSurveyPage = async (req, res) => {
    try {
        const { id } = req.params;
        const page = await SurveyPage.getById(id);
        if (!page) return res.status(404).json({ success: false, message: "Survey page not found!" });
        return res.status(200).json({ success: true, data: page });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSurveyPage = async (req, res) => {
    try {
        const { id } = req.params;
        const { complete_content, terminate_content, overquota_content, quality_term_content, survey_close_content } = req.body;

        const existing = await SurveyPage.getById(id);
        if (!existing) return res.status(404).json({ success: false, message: "Survey page not found!" });

        const updateData = {};
        if (complete_content !== undefined) updateData.complete_content = complete_content;
        if (terminate_content !== undefined) updateData.terminate_content = terminate_content;
        if (overquota_content !== undefined) updateData.overquota_content = overquota_content;
        if (quality_term_content !== undefined) updateData.quality_term_content = quality_term_content;
        if (survey_close_content !== undefined) updateData.survey_close_content = survey_close_content;

        await SurveyPage.update(id, updateData);

        const updated = await SurveyPage.getById(id);
        return res.status(200).json({ success: true, message: "Survey page updated successfully!", data: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};