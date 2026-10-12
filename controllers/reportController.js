import Project from '../models/projectModel.js';
import SurveyData from '../models/surveyDataModel.js';
import { getLocationFromIp } from '../utils/linkSecurityHelper.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';
import surveyPreScreenResponse from '../models/pre-screenResponseModel.js';
import { sendError } from './surveyDataController.js';



const PROJECT_REPORT_CSV_COLUMNS = [
    { label: 'Supplier ID', key: 'supplier_id' },
    { label: 'Supplier Name', key: 'supplier_name' },
    { label: 'Client ID', key: 'client_id' },
    { label: 'Supplier Identifier', key: 'supplier_identifier' },
    { label: 'Project URL Code', key: 'project_url_code' },
    { label: 'Status', key: 'status' },
    { label: 'Survey Start Date', key: 'survey_start_date' },
    { label: 'Survey End Date', key: 'survey_end_date' },
    { label: 'LOI Minutes', key: 'loi_minutes' },
    { label: 'IP Address', key: 'ip_address' },
    { label: 'Country', key: 'country' },
    { label: 'City', key: 'city' },
    { label: 'Is Test Link', key: 'is_test_link' },
    { label: 'IP Country Code', key: 'ip_country_code' },
    { label: 'IP Country Name', key: 'ip_country_name' },
    { label: 'IP State Name', key: 'ip_state_name' },
    { label: 'IP Time Zone', key: 'ip_time_zone' },
    { label: 'Is VPN', key: 'is_vpn' },
    { label: 'Fraud Score', key: 'fraud_score' },
    { label: 'Fraud Risk', key: 'fraud_risk' }
];

const mapProjectReportRows = (rows) =>
    rows.map(row => {
        const { country, city } = getLocationFromIp(row.ip_address);

        return {
            supplier_id: row.supplier_id,

            supplier_name: row.supplier_name
                ? `${row.supplier_name} (${row.supplier_code || ''})`.trim()
                : (row.supplier_code || null),

            client_id: row.client_id,

            supplier_identifier: row.supplier_identifier,

            project_url_code: row.project_url_code || null,

            status: row.status,

            survey_start_date: row.survey_start_date,

            survey_end_date: row.survey_end_date,

            loi_minutes: row.loi_minutes,

            ip_address: row.ip_address,

            country,

            city,

            is_test_link: !!row.is_test_link,

            ip_country_code: row.ip_country_code || null,
            ip_country_name: row.ip_country_name || null,
            ip_state_name: row.ip_state_name || null,
            ip_time_zone: row.ip_time_zone || null,
            is_vpn: row.is_vpn === null || row.is_vpn === undefined ? null : !!row.is_vpn,
            fraud_score: row.fraud_score ?? null,
            fraud_risk: row.fraud_risk || null
        };
    });

const projectReportFilters = (query) => ({
    partner_id: query.partner_id || null,
    status: query.status || 'all',
    project_url_code: query.project_url_code || query.projectUrlCode || null,
    country: query.country || null,
    is_test: query.is_test !== undefined ? query.is_test : null
});

// GET /api/project-reports/:id/report?page=&limit=&project_url_code=&country=&is_test=&partner_id=&status=
export const getProjectReport = async (req, res) => {
    try {
        const { id } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;

        const project = await Project.getById(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found!"
            });
        }

        const result = await SurveyData.getProjectReport(id, {
            ...projectReportFilters(req.query),
            page,
            limit,
            paginate: true
        });

        return res.status(200).json({
            success: true,
            project_name: project.Project_Name,
            data: mapProjectReportRows(result.rows || []),
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// GET /api/project-reports/:id/report/export/csv — full filtered set, no pagination
export const downloadProjectReportCsv = async (req, res) => {
    try {
        const { id } = req.params;

        const project = await Project.getById(id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found!"
            });
        }

        const result = await SurveyData.getProjectReport(id, {
            ...projectReportFilters(req.query),
            paginate: false
        });

        const data = mapProjectReportRows(result.rows || []);
        const csvData = buildCsv(data, PROJECT_REPORT_CSV_COLUMNS);

        return sendCsv(
            res,
            `project-report-${id}.csv`,
            csvData
        );

    } catch (error) {
        console.error("Download Project Report CSV Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
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

export const getPreScreenReport = async (req, res) => {
    try {
        const projectid = req.query.projectid;
        const is_test = req.query.is_test;

        if (!projectid) {
            return res.status(400).json({
                success: false,
                message: 'projectid is required!'
            });
        }

        const data = await surveyPreScreenResponse.getPreScreenReport({
            projectid,
            is_test: is_test !== undefined ? is_test : null
        });

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        return sendError(res, error);
    }
};



export const exportPreScreenReport = async (req, res) => {
    try {
        const projectid = req.query.projectid;
        const is_test = req.query.is_test;

        if (!projectid) {
            return res.status(400).json({
                success: false,
                message: 'projectid is required!'
            });
        }

        const data = await surveyPreScreenResponse.getPreScreenReport({
            projectid,
            is_test: is_test !== undefined ? is_test : null
        });

        const headers = [
            'S. No.',
            'UID',
            'Project Name',
            'Survey Date',
            'Answered At',
            'Partner ID',
            'Partner Name',
            'Client Name',
            'IP Address',
            'Question',
            'Answer',
            'Status',
            // 👇 NEW
            'IP Country Code',
            'IP Country Name',
            'IP State Name',
            'IP Time Zone',
            'Is VPN',
            'Fraud Score',
            'Fraud Risk'
        ];

        const escapeCsvValue = (value) => {
            if (value === null || value === undefined) {
                return '';
            }

            const stringValue = String(value);

            if (
                stringValue.includes(',') ||
                stringValue.includes('"') ||
                stringValue.includes('\n') ||
                stringValue.includes('\r')
            ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }

            return stringValue;
        };

        const csvRows = [
            headers.join(',')
        ];

        for (const row of data) {
            csvRows.push([
                row.serial_no,
                row.uid,
                row.project_name,
                row.survey_date,
                row.answered_at,
                row.partner_id,
                row.partner_name,
                row.client_name,
                row.ip_address,
                row.question,
                row.answer,
                row.status,
                // 👇 NEW
                row.ip_country_code,
                row.ip_country_name,
                row.ip_state_name,
                row.ip_time_zone,
                row.is_vpn === null || row.is_vpn === undefined ? '' : (row.is_vpn ? 'Yes' : 'No'),
                row.fraud_score,
                row.fraud_risk
            ].map(escapeCsvValue).join(','));
        }

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="pre-screen-report-${projectid}.csv"`
        );

        return res.status(200).send(csv);

    } catch (error) {
        return sendError(res, error);
    }
};
