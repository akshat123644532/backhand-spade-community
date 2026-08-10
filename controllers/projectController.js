import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from '../config/db.js';
import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import Partner from '../models/partnerModel.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';
const isMultiLink = (type) =>
    String(type || '').trim().toLowerCase().replace(/\s+/g, ' ') === 'multi link';

const parseMaybeJson = (val) => {
    if (typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch { return val; }
};

const parseCsvFile = (filePath) => {
    const fileContent = fs.readFileSync(filePath);
    return parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
    });
};

const pickCsvLinkFields = (row) => {
    const live =
        row.Live_Link || row.live_link || row.Test_Link || row.test_link || null;
    const vendor =
        row.VenderURL || row.vendor_url || row.VendorURL || row.Vender_URL || null;

    if (live || vendor) {
        return { Live_Link: live || null, VenderURL: vendor || null };
    }

    // Single-column (or unknown headers): use first non-empty value as Live_Link,
    // second (if any) as VenderURL
    const values = Object.values(row).filter((v) => v != null && String(v).trim() !== '');
    return {
        Live_Link: values[0] || null,
        VenderURL: values[1] || null
    };
};

const resolvePartnerMeta = async (partner_id) => {
    if (!partner_id) {
        return { partner_id: null, Vender_UserName: null, UserType: 'VENDOR' };
    }
    const partner = await Partner.getById(partner_id);
    if (!partner) {
        const err = new Error('Selected partner not found!');
        err.statusCode = 404;
        throw err;
    }
    return {
        partner_id: partner.id,
        Vender_UserName: partner.name || null,
        UserType: 'PARTNER'
    };
};

const mapCsvRowsToMultiUrls = (csvRows, { project_id, project_url_id, partner_id, Vender_UserName, UserType }) =>
    csvRows.map((row) => {
        const { Live_Link, VenderURL } = pickCsvLinkFields(row);
        return {
            project_id,
            project_url_id,
            partner_id,
            Live_Link,
            VenderURL,
            Vender_UserName,
            UserType,
            Status: 'active'
        };
    });

export const addProject = async (req, res) => {
    try {
        const {
            Project_Name, Clients, Project_Manager, Sales_Manager, RFQ, Project_Description,
            Project_Link_Type, Notes, Status, startDate, endDate
        } = req.body;

        if (!Project_Name) {
            return res.status(400).json({ success: false, message: "Project name is required!" });
        }

        const { id, Project_code } = await Project.create({
            Project_Name, Clients, Project_Manager, Sales_Manager, RFQ,
            Project_Description, Project_Link_Type, Notes, Status, startDate, endDate,
            action_by: req.user?.id || null
        });

        return res.status(201).json({
            success: true,
            message: "Project added successfully!",
            data: { id, Project_code, Project_Name }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
export const getAllProjects = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';

        const result = await Project.getAll({ page, limit, search, status });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const urlInfo = await ProjectUrl.getByProjectId(id);
        const multipleUrls = await ProjectMultipleUrl.getByProjectId(id);

        return res.status(200).json({
            success: true,
            data: { ...project, urlInfo, multipleUrls, multiLinkCount: multipleUrls.length }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { Project_Name, Clients, Project_Manager, Sales_Manager, RFQ, Project_Description, Project_Link_Type, Notes, Status, startDate, endDate } = req.body;

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const updateData = {};
        if (Project_Name) updateData.Project_Name = Project_Name;
        if (Clients) updateData.Clients = Clients;
        if (Project_Manager) updateData.Project_Manager = Project_Manager;
        if (Sales_Manager) updateData.Sales_Manager = Sales_Manager;
        if (RFQ) updateData.RFQ = RFQ;
        if (Project_Description) updateData.Project_Description = Project_Description;
        if (Project_Link_Type) updateData.Project_Link_Type = Project_Link_Type;
        if (Notes) updateData.Notes = Notes;
        if (Status) updateData.Status = Status;
        if (startDate !== undefined) updateData.startDate = startDate;
        if (endDate !== undefined) updateData.endDate = endDate;

        if (Object.keys(updateData).length > 0) await Project.update(id, updateData);

        return res.status(200).json({ success: true, message: "Project updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });
        await Project.delete(id);
        return res.status(200).json({ success: true, message: "Project deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleProjectStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { Status } = req.body;
        if (!['active', 'inactive'].includes(Status)) {
            return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        }
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });
        await Project.update(id, { Status });
        return res.status(200).json({ success: true, message: `Status updated to ${Status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// Project URL Info APIs — Multi Link: URL + CSV in one transaction
// Frontend sends: multipart with `metadata` (JSON string) + `file` (CSV)
export const addProjectUrl = async (req, res) => {
    const connection = await db.getConnection();
    let started = false;
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        // Frontend sends fields under `metadata` JSON string (+ optional flat fields)
        const metadata = parseMaybeJson(req.body?.metadata);
        const urlPayload = {
            ...(typeof metadata === 'object' && metadata ? metadata : {}),
            ...(req.body || {}),
        };
        // Prefer parsed metadata values over the raw JSON string field
        if (typeof metadata === 'object' && metadata) {
            Object.assign(urlPayload, metadata);
        }
        delete urlPayload.metadata;
        delete urlPayload.file;

        const multiLink = isMultiLink(project.Project_Link_Type);
        const sampleSize = Number(urlPayload.SampleSize);

        let csvRows = null;
        if (multiLink) {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "CSV file is required for Multi Link projects! Send as multipart/form-data with field name 'file' (or 'csv' / 'csvFile')."
                });
            }

            csvRows = parseCsvFile(req.file.path);
            if (!csvRows.length) {
                return res.status(400).json({ success: false, message: "CSV file is empty!" });
            }

            if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
                return res.status(400).json({ success: false, message: "SampleSize is required for Multi Link projects!" });
            }

            if (sampleSize !== csvRows.length) {
                return res.status(400).json({
                    success: false,
                    message: "Sample size and no. of links not equal",
                    sampleSize,
                    linksCount: csvRows.length
                });
            }
        }

        const partnerMeta = await resolvePartnerMeta(urlPayload.partner_id || req.body.partner_id || null);

        await connection.beginTransaction();
        started = true;

        const { id: urlId, project_url_code } = await ProjectUrl.create(
            { ...urlPayload, project_id: id, action_by: req.user?.id || null },
            connection
        );

        let csvInserted = 0;
        if (csvRows) {
            const rows = mapCsvRowsToMultiUrls(csvRows, {
                project_id: id,
                project_url_id: urlId,
                ...partnerMeta
            });
            csvInserted = await ProjectMultipleUrl.bulkCreate(rows, connection);
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: csvInserted
                ? `Project URL added with ${csvInserted} multi-URL row(s)!`
                : "Project URL added successfully!",
            data: {
                id: urlId,
                project_url_code,
                sampleSize: multiLink ? sampleSize : (urlPayload.SampleSize ?? null),
                linksCount: csvInserted,
                partner_id: partnerMeta.partner_id,
                UserType: partnerMeta.UserType
            }
        });
    } catch (error) {
        if (started) await connection.rollback();
        const status = error.statusCode || 500;
        return res.status(status).json({
            success: false,
            message: status === 500 ? "Server error!" : error.message,
            error: error.message
        });
    } finally {
        connection.release();
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup errors */ }
        }
    }
};

export const getProjectUrlList = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const urlList = await ProjectUrl.getByProjectId(id);
        return res.status(200).json({ success: true, data: urlList });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateProjectUrl = async (req, res) => {
    try {
        const { urlId } = req.params;
        const urlInfo = await ProjectUrl.getById(urlId);
        if (!urlInfo) return res.status(404).json({ success: false, message: "URL info not found!" });
        await ProjectUrl.update(urlId, { ...req.body, updated_by: req.user?.id || null });
        return res.status(200).json({ success: true, message: "Project URL updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteProjectUrl = async (req, res) => {
    try {
        const { urlId } = req.params;
        const urlInfo = await ProjectUrl.getById(urlId);
        if (!urlInfo) return res.status(404).json({ success: false, message: "URL info not found!" });
        await ProjectUrl.delete(urlId, req.user?.id || null);
        return res.status(200).json({ success: true, message: "Project URL deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// Multiple URLs APIs
export const addMultipleUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const urlInfoRows = await ProjectUrl.getByProjectId(id);
        const project_url_id = urlInfoRows?.[0]?.id || null;

        const urlId = await ProjectMultipleUrl.create({ ...req.body, project_id: id, project_url_id });
        return res.status(201).json({ success: true, message: "Multiple URL added successfully!", data: { id: urlId } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateMultipleUrl = async (req, res) => {
    try {
        const { urlId } = req.params;
        const url = await ProjectMultipleUrl.getById(urlId);
        if (!url) return res.status(404).json({ success: false, message: "URL not found!" });
        await ProjectMultipleUrl.update(urlId, req.body);
        return res.status(200).json({ success: true, message: "Multiple URL updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteMultipleUrl = async (req, res) => {
    try {
        const { urlId } = req.params;
        const url = await ProjectMultipleUrl.getById(urlId);
        if (!url) return res.status(404).json({ success: false, message: "URL not found!" });
        await ProjectMultipleUrl.delete(urlId);
        return res.status(200).json({ success: true, message: "Multiple URL deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// CSV upload — Live_Link + vendor_url → project_mutiple_Url (Multi Link only)
// Prefer POST /:id/url with CSV for new URL+CSV atomic create.
// This endpoint is for uploading CSV against an existing project_url_id.
export const uploadMultipleUrlCsv = async (req, res) => {
    const connection = await db.getConnection();
    let started = false;
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "CSV file is required!" });
        }

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        if (!isMultiLink(project.Project_Link_Type)) {
            return res.status(400).json({
                success: false,
                message: "CSV upload is only allowed for Multi Link projects!"
            });
        }

        let project_url_id = req.body.project_url_id || null;
        let urlInfo = null;
        if (project_url_id) {
            urlInfo = await ProjectUrl.getById(project_url_id);
            if (!urlInfo || Number(urlInfo.project_id) !== Number(id)) {
                return res.status(404).json({ success: false, message: "Project URL not found!" });
            }
        } else {
            const urlInfoRows = await ProjectUrl.getByProjectId(id);
            if (!urlInfoRows || !urlInfoRows.length) {
                return res.status(400).json({
                    success: false,
                    message: "Add Project URL Info first before uploading multiple URLs!"
                });
            }
            urlInfo = urlInfoRows[0];
            project_url_id = urlInfo.id;
        }

        const csvRows = parseCsvFile(req.file.path);
        if (!csvRows.length) {
            return res.status(400).json({ success: false, message: "CSV file is empty!" });
        }

        const sampleSize = Number(urlInfo.SampleSize);
        if (!Number.isFinite(sampleSize) || sampleSize !== csvRows.length) {
            return res.status(400).json({
                success: false,
                message: "Sample size and no. of links not equal",
                sampleSize: Number.isFinite(sampleSize) ? sampleSize : null,
                linksCount: csvRows.length
            });
        }

        const partnerMeta = await resolvePartnerMeta(req.body.partner_id || null);
        const rows = mapCsvRowsToMultiUrls(csvRows, {
            project_id: id,
            project_url_id,
            ...partnerMeta
        });

        await connection.beginTransaction();
        started = true;
        const inserted = await ProjectMultipleUrl.bulkCreate(rows, connection);
        await connection.commit();

        return res.status(200).json({
            success: true,
            message: `${inserted} row(s) uploaded successfully!`,
            project_url_id,
            sampleSize,
            linksCount: inserted,
            partner_id: partnerMeta.partner_id,
            UserType: partnerMeta.UserType
        });
    } catch (error) {
        if (started) await connection.rollback();
        const status = error.statusCode || 500;
        return res.status(status).json({
            success: false,
            message: status === 500 ? "Server error!" : error.message,
            error: error.message
        });
    } finally {
        connection.release();
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup errors */ }
        }
    }
};

// Multiple URLs — list all rows for a project (Project Multi URL Records)
export const getMultipleUrlList = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const records = await ProjectMultipleUrl.getByProjectId(id);
        return res.status(200).json({ success: true, data: records });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// Multi-link + sample allocation summary for a project
export const getMultiLinkStats = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const { totalMultiLinkCount, remainingMultiLinkCount, completedSurveyCount } = await ProjectMultipleUrl.getStatsByProjectId(id);
        const addPartner = remainingMultiLinkCount > 0;

        return res.status(200).json({
            success: true,
            data: {
                project_id: Number(id),
                totalMultiLinkCount,
                remainingMultiLinkCount,
                completedSurveyCount,
                addPartner
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
// Toggle between test/live mode for a project URL
export const toggleLinkMode = async (req, res) => {
    try {
        const { urlId } = req.params;
        const { link_mode } = req.body;

        if (!['test', 'live'].includes(link_mode)) {
            return res.status(400).json({ success: false, message: "link_mode must be 'test' or 'live'!" });
        }

        const urlInfo = await ProjectUrl.getById(urlId);
        if (!urlInfo) return res.status(404).json({ success: false, message: "URL info not found!" });

        await ProjectUrl.toggleLinkMode(urlId, link_mode);

        return res.status(200).json({
            success: true,
            message: `Link mode switched to ${link_mode}!`
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// Get the currently active link (test or live) — respondent redirect ke liye use hoga
export const getActiveSurveyLink = async (req, res) => {
    try {
        const { urlId } = req.params;

        const result = await ProjectUrl.getActiveLink(urlId);
        if (!result) return res.status(404).json({ success: false, message: "URL info not found!" });

        if (!result.active_link) {
            return res.status(400).json({
                success: false,
                message: `No ${result.link_mode} link configured for this project URL!`
            });
        }

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// Multiple URLs — download a blank CSV template for the "Download CSV Template" button
export const downloadCsvTemplate = async (req, res) => {
    try {
        const headers = 'Live_Link,vendor_url\n';
        const sampleRow = 'https://startSurveyLink?uid=[unique_user_id],www.Vendor/PartnerURL.com\n';

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="multi_url_template.csv"');
        return res.status(200).send(headers + sampleRow);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
export const exportProjectsCsv = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const result = await Project.getAll({ page: 1, limit: 1000000, search, status });

        const csv = buildCsv(result.data, [
            { label: 'ID', key: 'id' },
            { label: 'Project Code', key: 'Project_code' },
            { label: 'Project Name', key: 'Project_Name' },
            { label: 'Clients', key: 'Clients' },
            { label: 'Project Manager', key: 'Project_Manager' },
            { label: 'Sales Manager', key: 'Sales_Manager' },
            { label: 'Status', key: 'Status' },
            { label: 'Start Date', key: 'startDate' },
            { label: 'End Date', key: 'endDate' }
        ]);

        return sendCsv(res, 'projects.csv', csv);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

