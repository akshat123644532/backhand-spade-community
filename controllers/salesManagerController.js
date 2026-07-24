import jwt from 'jsonwebtoken';
import SalesManager from '../models/salesManagerModel.js';
import EmailTemplate from '../models/Emailtemplatemodel.js';
import { logActivity } from '../utils/activityLogger.js';
import { sendEmail } from '../config/mailer.js';
import { decrypt, encryptPasswordForStorage, verifyPassword } from '../utils/cryptoHelper.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in .env file! Application cannot start without it.');
}

const SALES_MANAGER_LOGIN_URL = 'https://spade-community-ui.vercel.app/sales/sales-manager';
const SALES_MANAGER_WELCOME_TEMPLATE_KEY = 'sales_manager_welcome';

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

        const plainPassword = decrypt(password);
        const isMatch = await verifyPassword(plainPassword, manager.password);
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

        const plainPassword = decrypt(password);
        const plainConfirmPassword = decrypt(confirm_password);
        if (plainPassword !== plainConfirmPassword) return res.status(400).json({ success: false, message: "Passwords do not match!" });

        const emailExists = await SalesManager.findByEmail(email);
        if (emailExists) return res.status(400).json({ success: false, message: "Email already registered!" });

        const code = await SalesManager.generateCode();
        const hashedPassword = await encryptPasswordForStorage(plainPassword);
        const profile_image = req.file ? `/uploads/${req.file.filename}` : null;

        await SalesManager.create({ code, name, email, password: hashedPassword, profile_image });

        await logActivity({ admin_id: req.user?.id, action: 'ADD', module: 'SalesManager', description: `Sales Manager "${name}" added`, ip_address: req.ip });

        let emailWarning = null;
        try {
            // Template DB se fetch karo instead of static HTML
            const template = await EmailTemplate.getByKey(SALES_MANAGER_WELCOME_TEMPLATE_KEY);

            if (!template) {
                // Template missing -> email skip karo but manager creation fail mat karo
                emailWarning = `Email template "${SALES_MANAGER_WELCOME_TEMPLATE_KEY}" not found. Welcome email was skipped.`;
                console.error('SALES MANAGER WELCOME EMAIL SKIPPED:', emailWarning);
            } else {
                const { subject, body } = EmailTemplate.render(template, {
                    name,
                    email,
                    password: plainPassword,
                    login_url: SALES_MANAGER_LOGIN_URL
                });

                const result = await sendEmail({ to: email, subject, html: body });

                if (result?.skipped) {
                    emailWarning = 'SMTP is not configured. Welcome email was skipped.';
                } else {
                    console.log(`SALES MANAGER WELCOME EMAIL SENT TO: ${email} ✅`);
                }
            }
        } catch (mailError) {
            emailWarning = mailError?.message || 'Welcome email could not be sent.';
            console.error('SALES MANAGER WELCOME EMAIL FAILED:', emailWarning);
        }

        return res.status(201).json({
            success: true,
            message: emailWarning
                ? 'Sales Manager added successfully, but welcome email could not be sent.'
                : 'Sales Manager added successfully!',
            ...(emailWarning && { email_warning: emailWarning }),
            data: { code, name, email }
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
        if (new_password) {
            const plainPassword = decrypt(new_password);
            updateData.password = await encryptPasswordForStorage(plainPassword);
        }

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