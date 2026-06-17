import Survey from '../models/surveyModel.js';
import { db } from '../config/db.js';

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

export const searchSurveys = async (req, res) => {
    try {
        const search = req.query.q || '';

        if (!search) {
            return res.status(400).json({ success: false, message: "Search query is required!" });
        }

        const [rows] = await db.execute(
            `SELECT s.id, s.survey_id, s.project_name, s.project_country,
             s.loi, s.ir, s.sample_size, s.currency, s.cpi,
             s.start_date, s.end_date, s.link_type,
             s.term_point, s.comp_point, s.status,
             c.name AS client_name, c.id AS client_id,
             pm.name AS project_manager_name, pm.id AS project_manager_id
             FROM surveys s
             LEFT JOIN PaperWardb.clients c ON s.client_id = c.id
             LEFT JOIN project_managers pm ON s.project_manager_id = pm.id
             WHERE s.deleted_at IS NULL
             AND (s.project_name LIKE ? OR s.survey_id LIKE ?)
             ORDER BY s.created_at DESC LIMIT 10`,
            [`%${search}%`, `%${search}%`]
        );

        return res.status(200).json({ success: true, data: rows });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getEligiblePartners = async (req, res) => {
    try {
        const { id } = req.params;

        const survey = await Survey.getById(id);
        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        const partners = await Survey.getEligiblePartners(id);

        return res.status(200).json({
            success: true,
            message: `${partners.length} eligible partners found`,
            filters_applied: {
                country: survey.project_country || null,
                sample_size: survey.sample_size || null,
                comp_point: survey.comp_point || null,
                term_point: survey.term_point || null,
            },
            data: partners
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const assignPartners = async (req, res) => {
    try {
        const { id } = req.params;
        const { partner_ids } = req.body;

        if (!partner_ids || !Array.isArray(partner_ids)) {
            return res.status(400).json({ success: false, message: "partner_ids array is required!" });
        }

        const survey = await Survey.getById(id);
        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        await Survey.assignPartners(survey.survey_id, partner_ids);

        return res.status(200).json({
            success: true,
            message: `${partner_ids.length} partner(s) assigned successfully!`
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAssignedPartners = async (req, res) => {
    try {
        const { id } = req.params;

        const survey = await Survey.getById(id);
        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        const partners = await Survey.getAssignedPartners(survey.survey_id);

        return res.status(200).json({ success: true, data: partners });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const removePartner = async (req, res) => {
    try {
        const { id, partnerId } = req.params;

        const survey = await Survey.getById(id);
        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        await Survey.removePartner(survey.survey_id, partnerId);

        return res.status(200).json({ success: true, message: "Partner removed from survey!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePartnerAllocation = async (req, res) => {
    try {
        const { id, partnerId } = req.params;
        const { allocated_size } = req.body;

        if (!allocated_size) {
            return res.status(400).json({ success: false, message: "allocated_size is required!" });
        }

        const survey = await Survey.getById(id);
        if (!survey) {
            return res.status(404).json({ success: false, message: "Survey not found!" });
        }

        await Survey.updatePartnerAllocation(survey.survey_id, partnerId, allocated_size);

        return res.status(200).json({ success: true, message: "Partner allocation updated!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
