const Admin = require('../models/adminModel');

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

        if (admin.password !== password) {
            return res.status(401).json({ success: false, message: "Galat password!" });
        }

        const updated = await Admin.incrementLoginCount(admin.id);
        
        if (!updated) {
            return res.status(500).json({ success: false, message: "Login count update fail." });
        }

        const freshAdminData = await Admin.findByEmail(email);

        res.status(200).json({
            success: true,
            message: "Login Successful!",
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
        res.status(500).json({ success: false, message: "Server error!" });
    }
};

module.exports = { loginAdmin };