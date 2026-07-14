import Project from '../models/projectModel.js';
import ProjectUrl from '../models/projectUrlModel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';

export const addProject = async (req, res) => {
    try {
        const { Project_Name, Clients, Project_Manager, Sales_Manager, RFQ, Project_Description, Project_Link_Type, Notes, Status, urlInfo, multipleUrls } = req.body;

        if (!Project_Name) {
            return res.status(400).json({ success: false, message: "Project name is required!" });
        }

        const { id, Project_code } = await Project.create({
            Project_Name, Clients, Project_Manager, Sales_Manager, RFQ,
            Project_Description, Project_Link_Type, Notes, Status,
            action_by: req.user?.id || null
        });

        // URL Info add karo
        if (urlInfo) {
            await ProjectUrl.create({ ...urlInfo, project_id: id, action_by: req.user?.id || null });
        }

        // Multiple URLs add karo
        if (multipleUrls && Array.isArray(multipleUrls) && multipleUrls.length > 0) {
            for (const url of multipleUrls) {
                await ProjectMultipleUrl.create({ ...url, project_id: id });
            }
        }

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
            data: { ...project, urlInfo, multipleUrls }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { Project_Name, Clients, Project_Manager, Sales_Manager, RFQ, Project_Description, Project_Link_Type, Notes, Status } = req.body;

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

export const updateProjectUrl = async (req, res) => {
    try {
        const { urlId } = req.params;
        const urlInfo = await ProjectUrl.getById(urlId);
        if (!urlInfo) return res.status(404).json({ success: false, message: "URL info not found!" });
        await ProjectUrl.update(urlId, req.body);
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
        await ProjectUrl.delete(urlId);
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

        const urlId = await ProjectMultipleUrl.create({ ...req.body, project_id: id });
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