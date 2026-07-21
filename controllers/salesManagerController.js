import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import SalesManager from '../models/salesManagerModel.js';
import { logActivity } from '../utils/activityLogger.js';
import transporter from '../config/mailer.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in .env file! Application cannot start without it.');
}

export const loginSalesManager = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required!" });
        }

        const manager = await SalesManager.findByEmailForLogin(email);
        if (!manager) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        if (manager.status !== 'active') {
            return res.status(403).json({ success: false, message: "Your account is inactive. Please contact admin." });
        }

        const isMatch = await bcrypt.compare(password, manager.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        const token = jwt.sign(
            { id: manager.id, email: manager.email, role: 'sales_manager' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            token,
            data: {
                id: manager.id,
                code: manager.code,
                name: manager.name,
                email: manager.email,
                image_url: manager.profile_image ? `${baseUrl}${manager.profile_image}` : null
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

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

        res.status(201).json({ success: true, message: "Sales Manager added successfully!", data: { code, name, email } });

        // welcome email with login credentials — fire-and-forget so API response isn't delayed
        transporter.sendMail({
            from: `"Spade Community" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Welcome to Spade Community - Your Login Credentials",
            html: `
                <p>Hi ${name},</p>
                <p>Welcome to the Spade Community!</p>
                <p>Your account has been created for Spade Community as Sales Manager.</p>
                <p>From now on, please log into your account using your email address and password.</p>
                <p>Use the below link to log in:<br/>
                <a href="https://spade-community-ui.vercel.app/sales/sales-manager">https://spade-community-ui.vercel.app/sales/sales-manager</a></p>
                <p>Your Login Credentials are:-<br/>
                Email - ${email}<br/>
                Password - ${password}</p>
                <p>Thank You,<br/>Spade Community</p>
            `
        }).then(() => {
            console.log(`SALES MANAGER WELCOME EMAIL SENT TO: ${email} ✅`);
        }).catch((err) => {
            console.error("SALES MANAGER WELCOME EMAIL FAILED:", err?.message || err);
        });

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

export const getSelfSalesManager = async (req, res) => {
    try {
        const manager = await SalesManager.getById(req.user.id);
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
        const { name, email, new_password, code } = req.body;
        const manager = await SalesManager.getById(id);
        if (!manager) return res.status(404).json({ success: false, message: "Sales Manager not found!" });

        // Agar code change kar rahe hain to check karo koi aur manager same code use to nahi kar raha
        if (code && code !== manager.code) {
            const codeExists = await SalesManager.findByCode(code);
            if (codeExists) return res.status(400).json({ success: false, message: "This code is already in use!" });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (code) updateData.code = code;
        if (req.file) updateData.profile_image = `/uploads/${req.file.filename}`;
        if (new_password) updateData.password = await bcrypt.hash(new_password, 10);

        await SalesManager.update(id, updateData);

        await logActivity({ admin_id: req.user?.id, action: 'UPDATE', module: 'SalesManager', description: `Sales Manager ID ${id} updated`, ip_address: req.ip });

        // fresh data return kar rahe hain taaki frontend turant naya image/name/email dikha sake bina reload ke
        const updatedManager = await SalesManager.getById(id);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const { profile_image, ...data } = updatedManager;

        return res.status(200).json({
            success: true,
            message: "Sales Manager updated successfully!",
            data: { ...data, image_url: profile_image ? `${baseUrl}${profile_image}` : null }
        });
    } catch (error) {
        if (error.message === "No fields provided to update!") {
            return res.status(400).json({ success: false, message: "No fields provided to update!" });
        }
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