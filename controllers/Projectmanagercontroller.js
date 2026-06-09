import bcrypt from 'bcrypt';
import ProjectManager from '../models/projectManagerModel.js';

const BASE_URL = (req) => `${req.protocol}://${req.get('host')}`;

export const addProjectManager = async (req, res) => {
    try {
        const { name, email, password, confirm_password } = req.body;

        if (!name || !email || !password || !confirm_password) {
            return res.status(400).json({ success: false, message: "All fields are required!" });
        }

        if (password !== confirm_password) {
            return res.status(400).json({ success: false, message: "Passwords do not match!" });
        }

        const emailExists = await ProjectManager.findByEmail(email);
        if (emailExists) {
            return res.status(400).json({ success: false, message: "Email already registered!" });
        }

        const code = await ProjectManager.generateCode();
        const hashedPassword = await bcrypt.hash(password, 10);
        const profile_image = req.file ? `/uploads/${req.file.filename}` : null;

        await ProjectManager.create({
            code, name, email,
            password: hashedPassword,
            profile_image
        });

        return res.status(201).json({
            success: true,
            message: "Project Manager added successfully!",
            data: { code, name, email }
        });

    } catch (error) {
        console.error("ADD PM ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllProjectManagers = async (req, res) => {
    try {
        const managers = await ProjectManager.getAll();

        const baseUrl = BASE_URL(req);
        const data = managers.map(m => ({
            ...m,
            profile_image: m.profile_image ? `${baseUrl}${m.profile_image}` : null
        }));

        return res.status(200).json({ success: true, count: data.length, data });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getProjectManagerById = async (req, res) => {
    try {
        const { id } = req.params;
        const manager = await ProjectManager.getById(id);

        if (!manager) {
            return res.status(404).json({ success: false, message: "Project Manager not found!" });
        }

        const baseUrl = BASE_URL(req);
        manager.profile_image = manager.profile_image ? `${baseUrl}${manager.profile_image}` : null;

        return res.status(200).json({ success: true, data: manager });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateProjectManager = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, new_password } = req.body;

        const manager = await ProjectManager.getById(id);
        if (!manager) {
            return res.status(404).json({ success: false, message: "Project Manager not found!" });
        }

        if (email && email !== manager.email) {
            const emailExists = await ProjectManager.findByEmail(email);
            if (emailExists) {
                return res.status(400).json({ success: false, message: "Email already in use!" });
            }
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (req.file) updateData.profile_image = `/uploads/${req.file.filename}`;
        if (new_password) updateData.password = await bcrypt.hash(new_password, 10);

        await ProjectManager.update(id, updateData);

        return res.status(200).json({ success: true, message: "Project Manager updated successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        }

        const manager = await ProjectManager.getById(id);
        if (!manager) {
            return res.status(404).json({ success: false, message: "Project Manager not found!" });
        }

        await ProjectManager.toggleStatus(id, status);

        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteProjectManager = async (req, res) => {
    try {
        const { id } = req.params;

        const manager = await ProjectManager.getById(id);
        if (!manager) {
            return res.status(404).json({ success: false, message: "Project Manager not found!" });
        }

        await ProjectManager.delete(id);

        return res.status(200).json({ success: true, message: "Project Manager deleted successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};