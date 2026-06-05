import Admin from '../models/adminModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import { db } from '../config/db.js';
import OTP from '../models/otpModel.js';

export const getSelf = async (req, res) => {
    try {
        const admin = await Admin.getById(req.user.id);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found!"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: admin
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const searchEmail = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        const admin = await Admin.findByEmail(email);
        if (admin) {
            return res.status(200).json({ success: true, exists: true, message: "Email already registered!" });
        }
        res.status(200).json({ success: true, exists: false, message: "Email is available!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const admin = await Admin.findByEmail(email);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found!"
            });
        }

        if (admin.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: "Account is inactive!"
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password!"
            });
        }

        await Admin.incrementLoginCount(admin.id);

        const token = jwt.sign(
            { id: admin.id, email: admin.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        await Admin.updateToken(admin.id, token);

        const freshAdminData = await Admin.findByEmail(email);
        const { password: adminPassword, token: storedToken, ...adminData } = freshAdminData;

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            data: { token, admin: adminData }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

const parsePermissions = (encoded) => {
    if (!encoded) return null;
    try {
        const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
        return JSON.stringify(decoded);
    } catch {
        return null;
    }
};

export const signupAdmin = async (req, res) => {
    try {
        // multer ke baad req.body access karo
        const name = req.body.name;
        const email = req.body.email;
        const password = req.body.password;
        const contact_no = req.body.contact_no;
        const permission_type = req.body.permission_type;
        const status = req.body.status;
        const permissions = req.body.permissions;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required!" });
        }

        const existingAdmin = await Admin.findByEmail(email);
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: "Email already registered!" });
        }

        const final_image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const permissionsJSON = parsePermissions(permissions);

        await Admin.create({
            name: name || null,
            email,
            password: hashedPassword,
            contact_no: contact_no || null,
            permission_type: permission_type || 'admin',
            permissions: permissionsJSON,
            image_url: final_image_url,
            status: status || 'active'
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;

        return res.status(201).json({
            success: true,
            message: "Admin added successfully!",
            data: {
                name,
                email,
                contact_no,
                image_url: final_image_url ? `${baseUrl}${final_image_url}` : null
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error!", error_details: error.message });
    }
};

export const updateAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, permission_type, status, permissions } = req.body;
    const performerId = req.user ? req.user.id : (req.body.updated_by || null);

    try {
        const final_image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);

        const permissionsJSON = permissions ? parsePermissions(permissions) : undefined;

        await Admin.update(id, {
            name: name || null,
            permission_type: permission_type || null,
            image_url: final_image_url,
            status: status || null,
            updated_by: performerId,
            ...(permissionsJSON !== undefined && { permissions: permissionsJSON })
        });

        res.status(200).json({ success: true, message: "Admin updated successfully!" });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        await Admin.delete(id);
        res.status(200).json({ success: true, message: "Admin deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required!" });
        }

        const admin = await Admin.findByEmail(email);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Email not registered!" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await OTP.create(email, otp, otpExpiry);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset OTP - PaperWar",
            text: `Your OTP for password reset is: ${otp}. This code is valid for 10 minutes only.`
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: "OTP has been sent to your email!" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;

    try {
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP are required!" });
        }

        const otpRecord = await OTP.findValidOTP(email, otp);
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "Invalid OTP or Email!" });
        }

        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ success: false, message: "OTP has expired!" });
        }

        await OTP.markVerified(otpRecord.otp_id);

        return res.status(200).json({ success: true, message: "OTP verified successfully!" });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: "All fields are required!" });
        }

        const otpRecord = await OTP.findValidOTP(email, otp);
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: "Invalid OTP!" });
        }

        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ success: false, message: "OTP has expired!" });
        }

        if (otpRecord.is_verified !== 1) {
            return res.status(400).json({ success: false, message: "OTP not verified!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await Admin.updatePassword(email, hashedPassword);

        return res.status(200).json({ success: true, message: "Password reset successful! You can now login." });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getAllAdmins = async (req, res) => {
    try {
        const admins = await Admin.getAll();
        res.status(200).json({ success: true, count: admins.length, admins });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getAdminById = async (req, res) => {
    const { id } = req.params;

    try {
        const admin = await Admin.getById(id);

        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found!" });
        }

        return res.status(200).json({
            success: true,
            message: "Admin fetched successfully",
            data: admin
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};