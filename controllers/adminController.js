const Admin = require('../models/adminModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const loginAdmin = async (req, res) => {
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

        const updated = await Admin.incrementLoginCount(admin.id);
        if (!updated) {
            return res.status(500).json({ success: false, message: "Login count update fail." });
        }

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

const signupAdmin = async (req, res) => {
    const { name, email, password, contact_no } = req.body;

    try {
        const existingAdmin = await Admin.findByEmail(email);
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: "Email pehle se register hai!" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await Admin.create({
            name,
            email,
            password: hashedPassword,
            contact_no,
            status: 'active'
        });

        res.status(201).json({
            success: true,
            message: "Signup Successful!",
            admin: {
                name,
                email,
                contact_no
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error!" });
    }
};

module.exports = { loginAdmin, signupAdmin };