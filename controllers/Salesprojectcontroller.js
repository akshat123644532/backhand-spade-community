import SalesProject from '../models/salesProjectModel.js';

const VALID_STATUS = ['wip', 'lost', 'won'];

export const addSalesProject = async (req, res) => {
    try {
        const { client_name, email, country, email_subject, status, comment } = req.body;

        if (!client_name || !email) {
            return res.status(400).json({ success: false, message: "Client name and email are required!" });
        }

        if (status && !VALID_STATUS.includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be wip, lost or won!" });
        }

        const emailExists = await SalesProject.findByEmail(email);
        if (emailExists) {
            return res.status(400).json({ success: false, message: "Project with this email already exists!" });
        }

        const project_id = await SalesProject.generateProjectId();

        await SalesProject.create({
            project_id, client_name, email, country,
            email_subject, status: status || 'wip', comment,
            created_by: req.user?.id || null
        });

        return res.status(201).json({
            success: true,
            message: "Sales project added successfully!",
            data: { project_id, client_name, email }
        });

    } catch (error) {
        console.error("ADD SALES PROJECT ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllSalesProjects = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const country = req.query.country || '';

        const result = await SalesProject.getAll({ page, limit, search, status, country });

        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSalesProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const project = await SalesProject.getById(id);

        if (!project) {
            return res.status(404).json({ success: false, message: "Sales project not found!" });
        }

        return res.status(200).json({ success: true, data: project });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSalesProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { client_name, email, country, email_subject, status, comment } = req.body;

        if (status && !VALID_STATUS.includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be wip, lost or won!" });
        }

        const project = await SalesProject.getById(id);
        if (!project) {
            return res.status(404).json({ success: false, message: "Sales project not found!" });
        }

        if (email && email !== project.email) {
            const emailExists = await SalesProject.findByEmail(email);
            if (emailExists) {
                return res.status(400).json({ success: false, message: "Email already in use!" });
            }
        }

        const updateData = { client_name, email, country, email_subject, status, comment };
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        await SalesProject.update(id, updateData);

        return res.status(200).json({ success: true, message: "Sales project updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteSalesProject = async (req, res) => {
    try {
        const { id } = req.params;

        const project = await SalesProject.getById(id);
        if (!project) {
            return res.status(404).json({ success: false, message: "Sales project not found!" });
        }

        await SalesProject.delete(id);

        return res.status(200).json({ success: true, message: "Sales project deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};