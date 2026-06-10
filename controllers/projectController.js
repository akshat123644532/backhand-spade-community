import Project from '../models/projectModel.js';

export const getDropdowns = async (req, res) => {
    try {
        const clients = await Project.getClients();
        const managers = await Project.getManagers();
        res.status(200).json({ success: true, clients, managers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addProject = async (req, res) => {
    try {
        const id = await Project.create(req.body);
        res.status(201).json({ success: true, message: "Project added!", id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const listProjects = async (req, res) => {
    try {
        const result = await Project.getAll(req.query);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};