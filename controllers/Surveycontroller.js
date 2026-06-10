import Survey from '../models/surveyModel.js';

export const addSurvey = async (req, res) => {
    try {
        const {
            project_name, client_id, project_manager_id, project_country,
            description, sales_manager_id, sales_project_id, loi, ir, sample_size,
            currency, start_date, end_date, link_type, term_point, comp_point,
            notes, cpi, live_url, test_url, status
        } = req.body;

        if (!project_name) {
            return res.status(400).json({ success: false, message: "Project name is required!" });
        }

        const survey_id = await Survey.generateSurveyId();

        await Survey.create({
            survey_id, project_name, client_id, project_manager_id, project_country,
            description, sales_manager_id, sales_project_id, loi, ir, sample_size,
            currency, start_date, end_date, link_type, term_point, comp_point,
            notes, cpi, live_url, test_url, status,
            created_by: req.user?.id || null
        });

        return res.status(201).json({
            success: true,
            message: "Survey added successfully!",
            data: { survey_id, project_name }
        });

    } catch (error) {
        console.error("ADD SURVEY ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllSurveys = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const result = await Survey.getAll({ page, limit, search, status });

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSurveyById = async (req, res) => {
    try {
        const { id } = req.params;
        const survey = await Survey.getById(id);

        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        return res.status(200).json({ success: true, data: survey });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSurvey = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            project_name, client_id, project_manager_id, project_country,
            description, sales_manager_id, sales_project_id, loi, ir, sample_size,
            currency, start_date, end_date, link_type, term_point, comp_point,
            notes, cpi, live_url, test_url, status
        } = req.body;

        const survey = await Survey.getById(id);
        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        const updateData = {
            project_name, client_id, project_manager_id, project_country,
            description, sales_manager_id, sales_project_id, loi, ir, sample_size,
            currency, start_date, end_date, link_type, term_point, comp_point,
            notes, cpi, live_url, test_url, status
        };

        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        await Survey.update(id, updateData);

        return res.status(200).json({ success: true, message: "Survey updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteSurvey = async (req, res) => {
    try {
        const { id } = req.params;

        const survey = await Survey.getById(id);
        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        await Survey.delete(id);

        return res.status(200).json({ success: true, message: "Survey deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};