import bcrypt from 'bcrypt';
import SalesManager from '../models/salesManagerModel.js';
import { logActivity } from '../utils/activityLogger.js';

export const addSalesManager = async (req, res) => {
    try {
        const { name, email, password, confirm_password } = req.body;
        if (!name || !email || !password || !confirm_password) return res.status(400).json({ success: false, message: "All fields are required!" });
        if (password !== confirm_password) return res.status(400).json({ success: false, message: "Passwords do not match!" });

        const emailExists = await SalesManager.findByEmail(email);
        if (emailExists) return res.status(400).json({ success: false, message: "Email already registered!" });

        const code = await SalesManager.generateCode();
        const hashedPassword = await bcrypt.hash(password, 10);
        const profile_image = req.file ? `/uploads/${req.file.filename}` : null;

        await SalesManager.create({ code, name, email, password: hashedPassword, profile_image });

        await logActivity({ admin_id: req.user?.id, action: 'ADD', module: 'SalesManager', description: `Sales Manager "${name}" added`, ip_address: req.ip });

        return res.status(201).json({ success: true, message: "Sales Manager added successfully!", data: { code, name, email } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllSalesManagers = async (req, res) => {
    try {
        const { page, limit, search, status } = req.query;
        const result = await SalesManager.getAll({ page, limit, search, status });
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        result.data = result.data.map(m => { const { profile_image, ...rest } = m; return { ...rest, image_url: profile_image ? `${baseUrl}${profile_image}` : null }; });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSalesManagerById = async (req, res) => {
    try {
        const manager = await SalesManager.getById(req.params.id);
        if (!manager) return res.status(404).json({ success: false, message: "Sales Manager not found!" });
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { profile_image, ...data } = manager;
        return res.status(200).json({ success: true, data: { ...data, image_url: profile_image ? `${baseUrl}${profile_image}` : null } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateSalesManager = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, new_password } = req.body;
        const manager = await SalesManager.getById(id);
        if (!manager) return res.status(404).json({ success: false, message: "Sales Manager not found!" });

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (req.file) updateData.profile_image = `/uploads/${req.file.filename}`;
        if (new_password) updateData.password = await bcrypt.hash(new_password, 10);

        await SalesManager.update(id, updateData);

        await logActivity({ admin_id: req.user?.id, action: 'UPDATE', module: 'SalesManager', description: `Sales Manager ID ${id} updated`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Sales Manager updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleStatus = async (req, res) => {
    try {
        const { status } = req.body;
        await SalesManager.toggleStatus(req.params.id, status);

        await logActivity({ admin_id: req.user?.id, action: 'STATUS_CHANGE', module: 'SalesManager', description: `Sales Manager ID ${req.params.id} status changed to ${status}`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteSalesManager = async (req, res) => {
    try {
        await SalesManager.delete(req.params.id);

        await logActivity({ admin_id: req.user?.id, action: 'DELETE', module: 'SalesManager', description: `Sales Manager ID ${req.params.id} deleted`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Sales Manager deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};