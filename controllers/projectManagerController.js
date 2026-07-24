import jwt from 'jsonwebtoken';
import ProjectManager from '../models/projectManagerModel.js';
import EmailTemplate from '../models/Emailtemplatemodel.js';
import { logActivity } from '../utils/activityLogger.js';
import { sendEmail } from '../config/mailer.js';
import { decrypt, encryptPasswordForStorage, verifyPassword } from '../utils/cryptoHelper.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in .env file! Application cannot start without it.');
}

const BASE_URL = (req) => `${req.protocol}://${req.get('host')}`;

export const loginProjectManager = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required!" });
        }

        const manager = await ProjectManager.findByEmailForLogin(email);
        if (!manager) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        if (manager.status !== 'active') {
            return res.status(403).json({ success: false, message: "Your account is inactive. Please contact admin." });
        }

        const plainPassword = decrypt(password);
        const isMatch = await verifyPassword(plainPassword, manager.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        const token = jwt.sign(
            { id: manager.id, email: manager.email, role: 'project_manager' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const baseUrl = BASE_URL(req);

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

export const addProjectManager = async (req, res) => {
    try {
        const { name, email, password, confirm_password } = req.body;
        if (!name || !email || !password || !confirm_password) return res.status(400).json({ success: false, message: "All fields are required!" });

        const plainPassword = decrypt(password);
        const plainConfirmPassword = decrypt(confirm_password);
        if (plainPassword !== plainConfirmPassword) return res.status(400).json({ success: false, message: "Passwords do not match!" });

        const emailExists = await ProjectManager.findByEmail(email);
        if (emailExists) return res.status(400).json({ success: false, message: "Email already registered!" });

        const code = await ProjectManager.generateCode();
        const hashedPassword = await encryptPasswordForStorage(plainPassword);
        const profile_image = req.file ? `/uploads/${req.file.filename}` : null;

        await ProjectManager.create({ code, name, email, password: hashedPassword, profile_image });

        await logActivity({ admin_id: req.user?.id, action: 'ADD', module: 'ProjectManager', description: `Project Manager "${name}" added`, ip_address: req.ip });

        let emailWarning = null;
        try {
            const template = await EmailTemplate.getByKey('Project Manager Login');
            if (!template) {
                emailWarning = 'Project Manager Login email template not found or inactive.';
            } else {
                const login_url = `${process.env.BASE_URL}/auth`;
                const { subject, body } = EmailTemplate.render(template, {
                    user_name: name,
                    login_url,
                    user_email: email,
                    password: plainPassword
                });

                const result = await sendEmail({
                    to: email,
                    subject,
                    text: body,
                    html: body.replace(/\n/g, '<br>')
                });
                if (result?.skipped) {
                    emailWarning = 'SMTP is not configured. Welcome email was skipped.';
                } else {
                    console.log(`PROJECT MANAGER WELCOME EMAIL SENT TO: ${email} ✅`);
                }
            }
        } catch (mailError) {
            emailWarning = mailError?.message || 'Welcome email could not be sent.';
            console.error('PROJECT MANAGER WELCOME EMAIL FAILED:', emailWarning);
        }

        return res.status(201).json({
            success: true,
            message: emailWarning
                ? 'Project Manager added successfully, but welcome email could not be sent.'
                : 'Project Manager added successfully!',
            ...(emailWarning && { email_warning: emailWarning }),
            data: { code, name, email }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllProjectManagers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const result = await ProjectManager.getAll({ page, limit, search, status });
        const baseUrl = BASE_URL(req);
        result.data = result.data.map(m => ({ ...m, profile_image: m.profile_image ? `${baseUrl}${m.profile_image}` : null }));
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getProjectManagerById = async (req, res) => {
    try {
        const { id } = req.params;
        const manager = await ProjectManager.getById(id);
        if (!manager) return res.status(404).json({ success: false, message: "Project Manager not found!" });
        const baseUrl = BASE_URL(req);
        manager.profile_image = manager.profile_image ? `${baseUrl}${manager.profile_image}` : null;
        return res.status(200).json({ success: true, data: manager });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getSelfProjectManager = async (req, res) => {
    try {
        const manager = await ProjectManager.getById(req.user.id);
        if (!manager) return res.status(404).json({ success: false, message: "Project Manager not found!" });
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
        if (!manager) return res.status(404).json({ success: false, message: "Project Manager not found!" });

        if (email && email !== manager.email) {
            const emailExists = await ProjectManager.findByEmail(email);
            if (emailExists) return res.status(400).json({ success: false, message: "Email already in use!" });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (req.file) updateData.profile_image = `/uploads/${req.file.filename}`;
        if (new_password) {
            const plainPassword = decrypt(new_password);
            updateData.password = await encryptPasswordForStorage(plainPassword);
        }

        await ProjectManager.update(id, updateData);

        await logActivity({ admin_id: req.user?.id, action: 'UPDATE', module: 'ProjectManager', description: `Project Manager ID ${id} updated`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Project Manager updated successfully!" });
    } catch (error) {
        if (error.message === "No fields provided to update!") {
            return res.status(400).json({ success: false, message: "No fields provided to update!" });
        }
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        const manager = await ProjectManager.getById(id);
        if (!manager) return res.status(404).json({ success: false, message: "Project Manager not found!" });
        await ProjectManager.toggleStatus(id, status);

        await logActivity({ admin_id: req.user?.id, action: 'STATUS_CHANGE', module: 'ProjectManager', description: `Project Manager ID ${id} status changed to ${status}`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deleteProjectManager = async (req, res) => {
    try {
        const { id } = req.params;
        const manager = await ProjectManager.getById(id);
        if (!manager) return res.status(404).json({ success: false, message: "Project Manager not found!" });
        await ProjectManager.delete(id);

        await logActivity({ admin_id: req.user?.id, action: 'DELETE', module: 'ProjectManager', description: `Project Manager ID ${id} deleted`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Project Manager deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};