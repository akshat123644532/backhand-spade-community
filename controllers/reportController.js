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

const formatSupplierReportRows = (rows) =>
    rows.map((row) => {
        const { country, city } = getLocationFromIp(row.ipAddress);
        return {
            supplierId: row.supplierId,
            partnerId: row.partnerId,
            partnerName: row.partnerName || null,
            clientName: row.clientName || null,
            partnersIdentifier: row.partnersIdentifier || null,
            status: row.status || null,
            surveyStartDate: row.surveyStartDate || null,
            surveyEndDate: row.surveyEndDate || null,
            LOI: row.LOI ?? null,
            ipAddress: row.ipAddress || null,
            geoLocation: [city, country].filter(Boolean).join(', ') || null,
            isTestLink: Number(row.isTestLink) === 1,
            finalIp: row.finalIp || null,
            multiLinkUrl: row.multiLinkUrl || null
        };
    });

// GET /api/project-reports/:projectId/supplier/:partnerId
export const getSupplierReport = async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);
        const partnerId = Number(req.params.partnerId);
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        if (!Number.isFinite(projectId) || !Number.isFinite(partnerId)) {
            return res.status(400).json({
                success: false,
                message: 'projectId and partnerId must be valid numbers!'
            });
        }

        const project = await Project.getById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found!' });
        }

        const result = await SurveyData.getSupplierReport({
            project_id: projectId,
            partner_id: partnerId,
            page,
            limit,
            paginate: true
        });

        const data = formatSupplierReportRows(result.rows || []);
        return res.status(200).json({
            success: true,
            data,
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error!', error: error.message });
    }
};

// GET /api/project-reports/:projectId/supplier/:partnerId/export/csv
export const downloadSupplierReportCsv = async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);
        const partnerId = Number(req.params.partnerId);

        if (!Number.isFinite(projectId) || !Number.isFinite(partnerId)) {
            return res.status(400).json({
                success: false,
                message: 'projectId and partnerId must be valid numbers!'
            });
        }

        const project = await Project.getById(projectId);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found!' });
        }

        const result = await SurveyData.getSupplierReport({
            project_id: projectId,
            partner_id: partnerId,
            paginate: false
        });

        const data = formatSupplierReportRows(result.rows || []);
        const csv = buildCsv(data, [
            { label: 'supplierId/partnerId', key: 'partnerId' },
            { label: 'Partner Name', key: 'partnerName' },
            { label: 'Client Name', key: 'clientName' },
            { label: 'partners Identifier', key: 'partnersIdentifier' },
            { label: 'status', key: 'status' },
            { label: 'survey startDate', key: 'surveyStartDate' },
            { label: 'survey end Date', key: 'surveyEndDate' },
            { label: 'LOI', key: 'LOI' },
            { label: 'Ip address', key: 'ipAddress' },
            { label: 'geoLocation', key: 'geoLocation' },
            { label: 'isTest link', key: 'isTestLink' },
            { label: 'finalIp', key: 'finalIp' },
            { label: 'MultiLinkUrl', key: 'multiLinkUrl' }
        ]);

        const safeName = String(project.Project_Name || 'project').replace(/[^a-z0-9]+/gi, '_');
        return sendCsv(res, `supplier_report_${safeName}_${partnerId}.csv`, csv);
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error!', error: error.message });
    }
};