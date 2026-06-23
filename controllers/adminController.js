import Admin from '../models/adminModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { db } from '../config/db.js';
import OTP from '../models/otpModel.js';
import { logActivity } from '../utils/activityLogger.js';
import { IMAGE_STORAGE_MODE } from '../middleware/uploadMiddleware.js';

const resolveImageUrl = (imageUrl, req) => {
    if (!imageUrl) return null;

    if (typeof imageUrl === 'string') {
        if (imageUrl.startsWith('/uploads/')) {
            return `${req.protocol}://${req.get('host')}${imageUrl}`;
        }
        return imageUrl;
    }

    if (Buffer.isBuffer(imageUrl)) {
        const storedPath = imageUrl.toString('utf8');
        if (storedPath.startsWith('/uploads/')) {
            return `${req.protocol}://${req.get('host')}${storedPath}`;
        }
        return imageUrl.toString('base64');
    }

    return null;
};

const buildSignupImageUrl = (req) => {
    if (!req.file) return req.body.image_url || null;

    if (IMAGE_STORAGE_MODE === 'blob') {
        return req.file.buffer;
    }

    return Buffer.from(`/uploads/${req.file.filename}`, 'utf8');
};

export const getSelf = async (req, res) => {
    try {
        const admin = await Admin.getById(req.user.id);
        if (!admin) return res.status(404).json({ success: false, message: "Admin not found!" });
        return res.status(200).json({ success: true, message: "Profile fetched successfully", data: admin });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

export const searchEmail = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) return res.status(400).json({ success: false, message: "Email is required" });
        const admin = await Admin.findByEmail(email);
        if (admin) return res.status(200).json({ success: true, exists: true, message: "Email already registered!" });
        res.status(200).json({ success: true, exists: false, message: "Email is available!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const admin = await Admin.findByEmail(email);
        if (!admin) return res.status(404).json({ success: false, message: "Admin not found!" });
        if (admin.status !== 'active') return res.status(403).json({ success: false, message: "Account is inactive!" });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid password!" });

        const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '1d' });
        await Admin.updateToken(admin.id, token);

        await logActivity({
            admin_id: admin.id,
            action: 'LOGIN',
            module: 'Auth',
            description: `${admin.name} logged in`,
            ip_address: req.ip
        });

        const freshAdminData = await Admin.findByEmail(email);
        const { password: adminPassword, token: storedToken, ...adminData } = freshAdminData;
        return res.status(200).json({ success: true, message: "Login successful!", data: { token, admin: adminData } });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const signupAdmin = async (req, res) => {
    try {
        const { name, email, password, contact_no, permission_type, status, permissions } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: "Email and password are required!" });

        const existingAdmin = await Admin.findByEmail(email);
        if (existingAdmin) return res.status(400).json({ success: false, message: "Email already registered!" });

        const final_image_url = buildSignupImageUrl(req);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        let parsedPermissions = permissions;
        if (typeof permissions === 'string') {
            try { parsedPermissions = JSON.parse(permissions); } catch (e) {}
        }
        const permissionsEncrypted = parsedPermissions ? Buffer.from(JSON.stringify(parsedPermissions)).toString('base64') : null;

        await Admin.create({ name: name || null, email, password: hashedPassword, contact_no: contact_no || null, permission_type: permission_type || 'admin', permissions: permissionsEncrypted, image_url: final_image_url, status: status || 'active' });

        await logActivity({
            admin_id: req.user?.id || null,
            action: 'ADD',
            module: 'Admin',
            description: `New admin "${name}" added with email ${email}`,
            ip_address: req.ip
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        let responseImageUrl = null;
        if (final_image_url) {
            if (typeof final_image_url === 'string' && final_image_url.startsWith('/uploads/')) {
                responseImageUrl = `${baseUrl}${final_image_url}`;
            } else {
                const imageBuffer = Buffer.isBuffer(final_image_url)
                    ? final_image_url
                    : (final_image_url?.type === 'Buffer' ? Buffer.from(final_image_url.data) : null);
                if (imageBuffer) {
                    const storedPath = imageBuffer.toString('utf8');
                    responseImageUrl = storedPath.startsWith('/uploads/')
                        ? `${baseUrl}${storedPath}`
                        : imageBuffer.toString('base64');
                }
            }
        }

        return res.status(201).json({ success: true, message: "Admin added successfully!", data: { name, email, contact_no, permissions: permissionsEncrypted, image_url: responseImageUrl } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error!", error_details: error.message });
    }
};

export const updateAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, permission_type, status, permissions } = req.body;
    const performerId = req.user?.id || req.body.updated_by || null;
    try {
        const final_image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);
        let permissionsEncrypted = undefined;
        if (permissions) {
            const dataToEncrypt = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
            permissionsEncrypted = Buffer.from(dataToEncrypt).toString('base64');
        }
        const updateData = { name, permission_type, image_url: final_image_url, status, updated_by: performerId };
        if (permissionsEncrypted !== undefined) updateData.permissions = permissionsEncrypted;
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        await Admin.update(id, updateData);

        await logActivity({
            admin_id: performerId,
            action: 'UPDATE',
            module: 'Admin',
            description: `Admin ID ${id} updated`,
            ip_address: req.ip
        });

        res.status(200).json({ success: true, message: "Admin updated successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update admin", error: error.message });
    }
};

export const deleteAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        await Admin.delete(id);

        await logActivity({
            admin_id: req.user?.id,
            action: 'DELETE',
            module: 'Admin',
            description: `Admin ID ${id} deleted`,
            ip_address: req.ip
        });

        res.status(200).json({ success: true, message: "Admin deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) return res.status(400).json({ success: false, message: "Email is required!" });
        const admin = await Admin.findByEmail(email);
        if (!admin) return res.status(404).json({ success: false, message: "Email not registered!" });

        const otp = "123456";
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await OTP.create(email, otp, otpExpiry);

        const mailOptions = { from: process.env.EMAIL_USER, to: email, subject: "Password Reset OTP - PaperWar", text: `Your OTP for password reset is: ${otp}. This code is valid for 10 minutes only.` };
        await transporter.sendMail(mailOptions);

        await logActivity({
            admin_id: admin.id,
            action: 'FORGOT_PASSWORD',
            module: 'Auth',
            description: `Password reset OTP sent to ${email}`,
            ip_address: req.ip
        });

        return res.status(200).json({ success: true, message: "OTP has been sent to your email!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    try {
        if (!email || !otp) return res.status(400).json({ success: false, message: "Email and OTP are required!" });
        const otpRecord = await OTP.findValidOTP(email, otp);
        if (!otpRecord) return res.status(400).json({ success: false, message: "Invalid OTP or Email!" });
        if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ success: false, message: "OTP has expired!" });
        await OTP.markVerified(otpRecord.otp_id);
        return res.status(200).json({ success: true, message: "OTP verified successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: "All fields are required!" });
        const otpRecord = await OTP.findValidOTP(email, otp);
        if (!otpRecord) return res.status(400).json({ success: false, message: "Invalid OTP!" });
        if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ success: false, message: "OTP has expired!" });
        if (otpRecord.is_verified !== 1) return res.status(400).json({ success: false, message: "OTP not verified!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await Admin.updatePassword(email, hashedPassword);

        await logActivity({
            admin_id: null,
            action: 'RESET_PASSWORD',
            module: 'Auth',
            description: `Password reset for ${email}`,
            ip_address: req.ip
        });

        return res.status(200).json({ success: true, message: "Password reset successful! You can now login." });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getAllAdmins = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const result = await Admin.getAll({ page, limit, search, status });
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getAdminById = async (req, res) => {
    const { id } = req.params;
    try {
        const admin = await Admin.getById(id);
        if (!admin) return res.status(404).json({ success: false, message: "Admin not found!" });
        return res.status(200).json({ success: true, message: "Admin fetched successfully", data: admin });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};


export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const adminId = req.user?.id;

        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized!" });
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All fields are required!" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "New password and confirm password do not match!" });
        }

        const admin = await Admin.getByIdWithPassword(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found!" });
        }

        const isMatch = await bcrypt.compare(currentPassword, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Current password is incorrect!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await Admin.updatePassword(admin.email, hashedPassword);

        await logActivity({
            admin_id: adminId,
            action: 'CHANGE_PASSWORD',
            module: 'Auth',
            description: `${admin.name} changed their password`,
            ip_address: req.ip
        });

        return res.status(200).json({ success: true, message: "Password updated successfully!" });

    } catch (error) {
        console.error("CHANGE PASSWORD ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};