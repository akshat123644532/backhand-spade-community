import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from '../config/db.js';
import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import Partner from '../models/partnerModel.js';
import Panelist from '../models/Panelistmodel.js';
import {
    enqueueMultiLinkCsvImport,
    getImportJobStatus,
    getLatestImportJobStatus
} from '../services/multiLinkCsvImportService.js';

const isMultiLink = (type) =>
    String(type || '').trim().toLowerCase().replace(/\s+/g, ' ') === 'multi link';

const parseMaybeJson = (val) => {
    if (typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch { return val; }
};

const parseCsvFile = (filePath) => {
    const fileContent = fs.readFileSync(filePath);
    const rows = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        comment: '#'
    });
    return rows;
};

/** CSV columns: Link_Live / Live_Link + email → Live_Link + email */
const pickCsvLinkFields = (row) => {
    const live =
        row.Link_Live || row.link_live || row.Live_Link || row.live_link ||
        row['Live Link'] || row['live link'] || row.Test_Link || row.test_link || null;
    const email =
        row.email || row.Email || row.EMAIL || null;

    if (live || email) {
        return {
            Live_Link: live ? String(live).trim() : null,
            email: email ? String(email).trim() : null
        };
    }

    const values = Object.values(row).filter(
        (v) => v != null && String(v).trim() !== '' && !String(v).trim().startsWith('#')
    );
    return {
        Live_Link: values[0] ? String(values[0]).trim() : null,
        email: values[1] ? String(values[1]).trim() : null
    };
};

const normalizeCsvRows = (csvRows) =>
    csvRows
        .map(pickCsvLinkFields)
        .filter((row) => row.Live_Link);

const validatePanelistAvailability = async (rows) => {
    const usedEmails = rows
        .map((r) => r.email)
        .filter(Boolean)
        .map((e) => e.toLowerCase());
    const missingCount = rows.filter((r) => !r.email).length;
    if (!missingCount) return;

    const available = await Panelist.countActive(usedEmails);
    if (available < missingCount) {
        const err = new Error(
            `Not enough active panelists for rows without email. Needed ${missingCount}, available ${available}.`
        );
        err.statusCode = 400;
        throw err;
    }
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

        let normalizedRows = null;
        if (multiLink) {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "CSV file is required for Multi Link projects! Send as multipart/form-data with field name 'file' (or 'csv' / 'csvFile')."
                });
            }

            const csvRows = parseCsvFile(req.file.path);
            normalizedRows = normalizeCsvRows(csvRows);

            if (!normalizedRows.length) {
                return res.status(400).json({ success: false, message: "CSV file is empty!" });
            }

            if (!Number.isFinite(sampleSize) || sampleSize <= 0) {
                return res.status(400).json({ success: false, message: "SampleSize is required for Multi Link projects!" });
            }

            if (sampleSize !== normalizedRows.length) {
                return res.status(400).json({
                    success: false,
                    message: "Sample size and no. of links not equal",
                    sampleSize,
                    linksCount: normalizedRows.length
                });
            }

            await validatePanelistAvailability(normalizedRows);
        }

        const partnerMeta = await resolvePartnerMeta(urlPayload.partner_id || req.body.partner_id || null);

        await connection.beginTransaction();
        started = true;

        const urlId = await ProjectUrl.create(
            { ...urlPayload, project_id: id, action_by: req.user?.id || null },
            connection
        );

        await connection.commit();
        started = false;

        let jobId = null;
        if (normalizedRows) {
            jobId = await enqueueMultiLinkCsvImport({
                project_id: Number(id),
                project_url_id: urlId,
                partner_id: partnerMeta.partner_id,
                user_type: partnerMeta.UserType,
                rows: normalizedRows
            });
        }

        return res.status(201).json({
            success: true,
            message: jobId
                ? "Project URL added. Multi-link CSV import started in background."
                : "Project URL added successfully!",
            data: {
                id: urlId,
                sampleSize: multiLink ? sampleSize : (urlPayload.SampleSize ?? null),
                linksCount: normalizedRows?.length || 0,
                partner_id: partnerMeta.partner_id,
                UserType: partnerMeta.UserType,
                jobId,
                importStatus: jobId ? 'pending' : null
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

        const metadata = parseMaybeJson(req.body?.metadata);
        const payload = {
            ...(typeof metadata === 'object' && metadata ? metadata : {}),
            ...(req.body || {}),
            updated_by: req.user?.id || null
        };
        if (typeof metadata === 'object' && metadata) {
            Object.assign(payload, metadata);
        }
        delete payload.metadata;
        delete payload.file;

        await ProjectUrl.update(urlId, payload);
        const updated = await ProjectUrl.getById(urlId);

        return res.status(200).json({
            success: true,
            message: "Project URL updated successfully!",
            data: updated
        });
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

// CSV upload — Live_Link + email → background import (Multi Link only)
// Prefer POST /:id/url with CSV for new URL+CSV atomic create.
// This endpoint is for uploading CSV against an existing project_url_id.
export const uploadMultipleUrlCsv = async (req, res) => {
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
        const normalizedRows = normalizeCsvRows(csvRows);
        if (!normalizedRows.length) {
            return res.status(400).json({ success: false, message: "CSV file is empty!" });
        }

        const sampleSize = Number(urlInfo.SampleSize);
        if (!Number.isFinite(sampleSize) || sampleSize !== normalizedRows.length) {
            return res.status(400).json({
                success: false,
                message: "Sample size and no. of links not equal",
                sampleSize: Number.isFinite(sampleSize) ? sampleSize : null,
                linksCount: normalizedRows.length
            });
        }

        await validatePanelistAvailability(normalizedRows);

        const partnerMeta = await resolvePartnerMeta(req.body.partner_id || null);
        const jobId = await enqueueMultiLinkCsvImport({
            project_id: Number(id),
            project_url_id: Number(project_url_id),
            partner_id: partnerMeta.partner_id,
            user_type: partnerMeta.UserType,
            rows: normalizedRows
        });

        return res.status(202).json({
            success: true,
            message: "CSV accepted. Multi-link import started in background.",
            data: {
                project_url_id,
                sampleSize,
                linksCount: normalizedRows.length,
                partner_id: partnerMeta.partner_id,
                UserType: partnerMeta.UserType,
                jobId,
                importStatus: 'pending'
            }
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({
            success: false,
            message: status === 500 ? "Server error!" : error.message,
            error: error.message
        });
    } finally {
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup errors */ }
        }
    }
};

// Poll background multi-link CSV import status
export const getMultiLinkCsvImportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { jobId, project_url_id } = req.query;

        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        let status = null;
        if (jobId) {
            status = await getImportJobStatus(jobId);
            if (status && Number(status.project_id) !== Number(id)) {
                return res.status(404).json({ success: false, message: "Import job not found for this project!" });
            }
        } else if (project_url_id) {
            status = await getLatestImportJobStatus(id, project_url_id);
        } else {
            return res.status(400).json({
                success: false,
                message: "Provide jobId or project_url_id as query param!"
            });
        }

        if (!status) {
            return res.status(404).json({ success: false, message: "Import job not found!" });
        }

        return res.status(200).json({ success: true, data: status });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
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

        // Single link: only allow partner add flag
        if (!isMultiLink(project.Project_Link_Type)) {
            return res.status(200).json({
                success: true,
                data: { addPartner: true }
            });
        }

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
        const availablePanelists = await Panelist.getAllPanelistsCount();
        const note = `We have ${availablePanelists} available panelists. Add a minimum of half or more than half of Live Link users with their unique email.`;

        const headers = 'Link_Live,Email\n';
        const sampleRow = 'https://startSurveyLink?uid=[unique_user_id],user@example.com\n';
        const noteRow = `# ${note}\n`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="multi_url_template.csv"');
        res.setHeader('X-Template-Note', note);
        res.setHeader('X-Available-Panelists', String(availablePanelists));
        res.setHeader('Access-Control-Expose-Headers', 'X-Template-Note, X-Available-Panelists');
        return res.status(200).send(headers + sampleRow + noteRow);
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};