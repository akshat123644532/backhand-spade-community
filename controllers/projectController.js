import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from '../config/db.js';
import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import Partner from '../models/partnerModel.js';
import SupplierMapping from '../models/supplierMappingModel.js';

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
        trim: true
    });
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
    csvRows.map((row) => ({
        project_id,
        project_url_id,
        partner_id,
        Live_Link: row.Live_Link || row.live_link || null,
        VenderURL: row.VenderURL || row.vendor_url || row.VendorURL || null,
        Vender_UserName,
        UserType,
        Status: 'active'
    }));

export const addProject = async (req, res) => {
    const connection = await db.getConnection();
    let started = false;
    try {
        let {
            Project_Name, Clients, Project_Manager, Sales_Manager, RFQ, Project_Description,
            Project_Link_Type, Notes, Status, startDate, endDate, urlInfo, multipleUrls, partner_id
        } = req.body;

        urlInfo = parseMaybeJson(urlInfo);
        multipleUrls = parseMaybeJson(multipleUrls);
        partner_id = partner_id || urlInfo?.partner_id || null;

        if (!Project_Name) {
            return res.status(400).json({ success: false, message: "Project name is required!" });
        }

        const multiLink = isMultiLink(Project_Link_Type);
        if (req.file && !multiLink) {
            return res.status(400).json({
                success: false,
                message: "CSV upload is only allowed when Project_Link_Type is 'Multi Link'!"
            });
        }

        let csvRows = null;
        if (req.file && multiLink) {
            csvRows = parseCsvFile(req.file.path);
            if (!csvRows.length) {
                return res.status(400).json({ success: false, message: "CSV file is empty!" });
            }
        }

        const partnerMeta = await resolvePartnerMeta(partner_id);

        await connection.beginTransaction();
        started = true;

        const { id, Project_code } = await Project.create({
            Project_Name, Clients, Project_Manager, Sales_Manager, RFQ,
            Project_Description, Project_Link_Type, Notes, Status, startDate, endDate,
            action_by: req.user?.id || null
        }, connection);

        let urlInfoId = null;
        if (urlInfo) {
            urlInfoId = await ProjectUrl.create(
                { ...urlInfo, project_id: id, action_by: req.user?.id || null },
                connection
            );
        }

        let csvInserted = 0;
        if (csvRows) {
            if (!urlInfoId) {
                throw Object.assign(new Error("urlInfo is required before uploading multiple URLs!"), { statusCode: 400 });
            }
            const rows = mapCsvRowsToMultiUrls(csvRows, {
                project_id: id,
                project_url_id: urlInfoId,
                ...partnerMeta
            });
            csvInserted = await ProjectMultipleUrl.bulkCreate(rows, connection);
        } else if (multiLink && Array.isArray(multipleUrls) && multipleUrls.length > 0) {
            const rows = multipleUrls.map((url) => ({
                ...url,
                project_id: id,
                project_url_id: urlInfoId,
                partner_id: url.partner_id ?? partnerMeta.partner_id,
                Vender_UserName: url.Vender_UserName ?? partnerMeta.Vender_UserName,
                UserType: url.UserType ?? partnerMeta.UserType,
                Status: url.Status || 'active'
            }));
            await ProjectMultipleUrl.bulkCreate(rows, connection);
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: csvInserted
                ? `Project added successfully with ${csvInserted} multi-URL row(s)!`
                : "Project added successfully!",
            data: { id, Project_code, Project_Name, csvInserted }
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

// Project URL Info APIs
export const addProjectUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.getById(id);
        if (!project) return res.status(404).json({ success: false, message: "Project not found!" });

        const urlId = await ProjectUrl.create({ ...req.body, project_id: id, action_by: req.user?.id || null });
        return res.status(201).json({ success: true, message: "Project URL added successfully!", data: { id: urlId } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
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
export const uploadMultipleUrlCsv = async (req, res) => {
    try {
        const { id } = req.params; // project_id

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
        if (!project_url_id) {
            const urlInfoRows = await ProjectUrl.getByProjectId(id);
            if (!urlInfoRows || !urlInfoRows.length) {
                return res.status(400).json({
                    success: false,
                    message: "Add Project URL Info first before uploading multiple URLs!"
                });
            }
            project_url_id = urlInfoRows[0].id;
        }

        const csvRows = parseCsvFile(req.file.path);
        if (!csvRows.length) {
            return res.status(400).json({ success: false, message: "CSV file is empty!" });
        }

        const partnerMeta = await resolvePartnerMeta(req.body.partner_id || null);
        const rows = mapCsvRowsToMultiUrls(csvRows, {
            project_id: id,
            project_url_id,
            ...partnerMeta
        });

        const inserted = await ProjectMultipleUrl.bulkCreate(rows);

        return res.status(200).json({
            success: true,
            message: `${inserted} row(s) uploaded successfully!`,
            project_url_id,
            partner_id: partnerMeta.partner_id,
            UserType: partnerMeta.UserType
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

        const [{ totalMultiLinkCount, remainingMultiLinkCount }, sampleSize, samplesAdded] = await Promise.all([
            ProjectMultipleUrl.getStatsByProjectId(id),
            ProjectUrl.getSampleSizeByProjectId(id),
            SupplierMapping.getQuotaSumByProjectId(id)
        ]);

        const addPartner = samplesAdded < sampleSize;

        return res.status(200).json({
            success: true,
            data: {
                project_id: Number(id),
                totalMultiLinkCount,
                remainingMultiLinkCount,
                sampleSize,
                samplesAdded,
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