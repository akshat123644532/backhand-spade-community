import Admin from '../models/adminModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

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
            return res.status(200).json({ success: true, exists: true, message: "Email pehle se register hai!" });
        }
        res.status(200).json({ success: true, exists: false, message: "Email available hai!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const admin = await Admin.findByEmail(email);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin nahi mila!" });
        }
        if (admin.status !== 'active') {
            return res.status(403).json({ success: false, message: "Account inactive hai!" });
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Galat password!" });
        }
        
        await Admin.incrementLoginCount(admin.id);
        
        const freshAdminData = await Admin.findByEmail(email);
        const token = jwt.sign(
            { id: freshAdminData.id, email: freshAdminData.email },
            process.env.JWT_SECRET || 'fallback_secret_key_123_secured',
            { expiresIn: '1d' }
        );
        res.status(200).json({
            success: true,
            message: "Login Successful!",
            token: token,
            admin: {
                id: freshAdminData.id,
                name: freshAdminData.name,
                email: freshAdminData.email,
                permission_type: freshAdminData.permission_type,
                image_url: freshAdminData.image_url,
                contact_no: freshAdminData.contact_no,
                login_count: freshAdminData.login_count,
                status: freshAdminData.status
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error!", error_details: error.message });
    }
};

export const signupAdmin = async (req, res) => {
    const { name, email, password, contact_no, permission_type, status } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email aur Password zaroori hain!" });
        }

        const existingAdmin = await Admin.findByEmail(email);
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: "Email pehle se register hai!" });
        }
        
        const final_image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await Admin.create({
            name: name || null,
            email: email || null,
            password: hashedPassword,
            contact_no: contact_no || null,
            permission_type: permission_type || 'read',
            image_url: final_image_url,
            status: status || 'active'
        });
        
        res.status(201).json({
            success: true,
            message: "Signup Successful!",
            admin: { name, email, contact_no, image_url: final_image_url }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error!", error_details: error.message });
    }
};

export const updateAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, permission_type, status } = req.body;
    const performerId = req.user ? req.user.id : (req.body.updated_by || null);
    try {
        const final_image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || null);
        
        await Admin.update(id, { 
            name: name || null, 
            permission_type: permission_type || null, 
            image_url: final_image_url, 
            status: status || null, 
            updated_by: performerId
        });
        res.status(200).json({ success: true, message: "Admin updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        await Admin.delete(id);
        res.status(200).json({ success: true, message: "Admin deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ success: false, message: "Email zaroori hai!" });
        }

        const admin = await Admin.findByEmail(email);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Yeh email register nahi hai!" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        await Admin.updateOTP(email, otp, otpExpiry);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP - PaperWar',
            text: `Bhai, aapka password reset karne ke liye OTP yeh hai: ${otp}. Yeh sirf 10 minute tak valid hai.`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ success: true, message: "OTP aapke email par bhej diya gaya hai!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error!", error_details: error.message });
    }
};

export const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    try {
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email aur OTP dono zaroori hain!" });
        }

        const admin = await Admin.findByOTP(email, otp);
        if (!admin) {
            return res.status(400).json({ success: false, message: "Galat OTP ya Email!" });
        }

        if (new Date() > new Date(admin.otp_expiry)) {
            return res.status(400).json({ success: false, message: "OTP expire ho chuka hai!" });
        }

        res.status(200).json({ success: true, message: "OTP verified! Ab aap password badal sakte ho." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: "Saare fields zaroori hain!" });
        }

        const admin = await Admin.findByOTP(email, otp);
        if (!admin) {
            return res.status(400).json({ success: false, message: "Invalid request! OTP fir se check karein." });
        }

        if (new Date() > new Date(admin.otp_expiry)) {
            return res.status(400).json({ success: false, message: "OTP expire ho chuka hai!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await Admin.updatePassword(email, hashedPassword);
        res.status(200).json({ success: true, message: "Password kamiyabi se badal gaya hai! Ab login karein." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
            return res.status(404).json({ success: false, message: "Admin nahi mila!" });
        }
        res.status(200).json({ success: true, admin });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};