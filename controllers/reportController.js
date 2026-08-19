import Project from '../models/projectModel.js';
import SurveyData from '../models/surveyDataModel.js';
import { getLocationFromIp } from '../utils/linkSecurityHelper.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';

// Shared: fetch + shape the report rows (used by both the JSON view and the CSV download)
const buildReportRows = async (project_id, partner_id) => {
    const rows = await SurveyData.getProjectReport(project_id, { partner_id: partner_id || null });

    return rows.map(row => {
        const { country, city } = getLocationFromIp(row.ip_address);
        return {
            supplier_id: row.supplier_id,
            supplier_name: row.supplier_name
                ? `${row.supplier_name} (${row.supplier_code || ''})`.trim()
                : (row.supplier_code || null),
            client_id: row.client_id,
            supplier_identifier: row.supplier_identifier,
            status: row.status,
            survey_start_date: row.survey_start_date,
            survey_end_date: row.survey_end_date,
            loi_minutes: row.loi_minutes,
            ip_address: row.ip_address,
            country,
            city,
            is_test_link: !!row.is_test_link
        };
    });
};

// GET /project/:id/report?partner_id=optional
export const getProjectReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { partner_id } = req.query;

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const data = await buildReportRows(id, partner_id);

        return res.status(200).json({
            success: true,
            project_name: project.Project_Name,
            data
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// GET /project/:id/report/export/csv?partner_id=optional
export const downloadProjectReportCsv = async (req, res) => {
    try {
        const { id } = req.params;
        const { partner_id } = req.query;

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const data = await buildReportRows(id, partner_id);

        const csv = buildCsv(data, [
            { label: 'Supplier Id', key: 'supplier_id' },
            { label: 'Supplier Name', key: 'supplier_name' },
            { label: 'Client ID', key: 'client_id' },
            { label: 'Supplier Identifier', key: 'supplier_identifier' },
            { label: 'Status', key: 'status' },
            { label: 'Survey Start Date', key: 'survey_start_date' },
            { label: 'Survey End Date', key: 'survey_end_date' },
            { label: 'LOI(mins)', key: 'loi_minutes' },
            { label: 'IP Address', key: 'ip_address' },
            { label: 'Country', key: 'country' },
            { label: 'City', key: 'city' },
            { label: 'Is Test Link', key: 'is_test_link' }
        ]);

        const safeName = String(project.Project_Name || 'project').replace(/[^a-z0-9]+/gi, '_');
        return sendCsv(res, `project_report_${safeName}.csv`, csv);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};