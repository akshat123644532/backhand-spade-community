import SurveySetting from '../models/surveySettingModel.js';
import { logActivity } from '../utils/activityLogger.js';

export const getAllSurveySettings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        const result = await SurveySetting.getAll({ page, limit, search });

        return res.status(200).json({
            success: true,
            message: "Survey settings fetched successfully",
            ...result
        });
    } catch (error) {
        console.error('GET ALL SURVEY SETTINGS error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

export const getSurveySettingById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: "Invalid survey setting ID!"
            });
        }

        const setting = await SurveySetting.getById(parseInt(id));

        if (!setting) {
            return res.status(404).json({
                success: false,
                message: "Survey setting not found!"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Survey setting fetched successfully",
            data: setting
        });
    } catch (error) {
        console.error('GET SURVEY SETTING BY ID error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

export const getSurveySettingByLanguage = async (req, res) => {
    try {
        const { language } = req.params;

        if (!language || language.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Language is required!"
            });
        }

        const setting = await SurveySetting.getByLanguage(language);

        if (!setting) {
            return res.status(404).json({
                success: false,
                message: `Survey setting for language "${language}" not found!`
            });
        }

        return res.status(200).json({
            success: true,
            message: "Survey setting fetched successfully",
            data: setting
        });
    } catch (error) {
        console.error('GET SURVEY SETTING BY LANGUAGE error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

export const addSurveySetting = async (req, res) => {
    try {
        const {
            language,
            complete_redirect_content,
            terminate_redirect_content,
            quality_term_redirect_content,
            survey_close_redirect_content
        } = req.body;

        if (!language || language.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Language is required!"
            });
        }

        const existing = await SurveySetting.getByLanguage(language);
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Survey setting for language "${language}" already exists!`
            });
        }

        const settingId = await SurveySetting.create({
            language,
            complete_redirect_content,
            terminate_redirect_content,
            quality_term_redirect_content,
            survey_close_redirect_content
        });

        await logActivity({
            admin_id: req.user?.id || null,
            action: 'CREATE',
            module: 'Survey Settings',
            description: `Survey setting created for language: ${language}`,
            ip_address: req.ip || null
        });

        return res.status(201).json({
            success: true,
            message: "Survey setting added successfully!",
            data: { id: settingId, language }
        });
    } catch (error) {
        console.error('ADD SURVEY SETTING error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

export const updateSurveySetting = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: "Invalid survey setting ID!"
            });
        }

        const parsedId = parseInt(id);

        const setting = await SurveySetting.getById(parsedId);
        if (!setting) {
            return res.status(404).json({
                success: false,
                message: "Survey setting not found!"
            });
        }

        const {
            complete_redirect_content,
            terminate_redirect_content,
            quality_term_redirect_content,
            survey_close_redirect_content
        } = req.body;

        const updateData = {};

        if (complete_redirect_content !== undefined) {
            updateData.complete_redirect_content = complete_redirect_content;
        }
        if (terminate_redirect_content !== undefined) {
            updateData.terminate_redirect_content = terminate_redirect_content;
        }
        if (quality_term_redirect_content !== undefined) {
            updateData.quality_term_redirect_content = quality_term_redirect_content;
        }
        if (survey_close_redirect_content !== undefined) {
            updateData.survey_close_redirect_content = survey_close_redirect_content;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Nothing to update!"
            });
        }

        await SurveySetting.update(parsedId, updateData);

        const updatedSetting = await SurveySetting.getById(parsedId);

        await logActivity({
            admin_id: req.user?.id || null,
            action: 'UPDATE',
            module: 'Survey Settings',
            description: `Survey setting updated for language: ${setting.language}`,
            ip_address: req.ip || null
        });

        return res.status(200).json({
            success: true,
            message: "Survey setting updated successfully!",
            data: updatedSetting
        });
    } catch (error) {
        console.error('UPDATE SURVEY SETTING error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

export const deleteSurveySetting = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({
                success: false,
                message: "Invalid survey setting ID!"
            });
        }

        const parsedId = parseInt(id);

        const setting = await SurveySetting.getById(parsedId);
        if (!setting) {
            return res.status(404).json({
                success: false,
                message: "Survey setting not found!"
            });
        }

        await SurveySetting.delete(parsedId);

        await logActivity({
            admin_id: req.user?.id || null,
            action: 'DELETE',
            module: 'Survey Settings',
            description: `Survey setting deleted for language: ${setting.language}`,
            ip_address: req.ip || null
        });

        return res.status(200).json({
            success: true,
            message: "Survey setting deleted successfully!"
        });
    } catch (error) {
        console.error('DELETE SURVEY SETTING error:', error.message);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};