import Permission from '../models/permissionModel.js';

// moduleName ko route ke hisaab se pass karoge, e.g. 'User Management' ya 'Admin'
export const checkDownloadPermission = (moduleName) => {
    return async (req, res, next) => {
        try {
            const adminId = req.user?.id;
            if (!adminId) {
                return res.status(401).json({ success: false, message: "Unauthorized!" });
            }

            const allowed = await Permission.hasDownloadAccess(adminId, moduleName);
            if (!allowed) {
                return res.status(403).json({
                    success: false,
                    message: "Aapko is module ka CSV download karne ki permission nahi hai!"
                });
            }

            next();
        } catch (error) {
            return res.status(500).json({ success: false, message: "Server error!", error: error.message });
        }
    };
};