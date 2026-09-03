import Admin from '../models/adminModel.js';
import { hasDownloadAccess } from '../utils/permissionsHelper.js';

// Usage: router.get('/export/csv', verifyToken, checkCsvDownloadPermission('SalesManager'), exportController);
export const checkCsvDownloadPermission = (moduleName) => {
    return async (req, res, next) => {
        try {
            const adminId = req.user?.id;
            if (!adminId) {
                return res.status(401).json({ success: false, message: "Unauthorized!" });
            }

            const admin = await Admin.getById(adminId);
            if (!admin) {
                return res.status(404).json({ success: false, message: "Admin not found!" });
            }

            if (!hasDownloadAccess(admin.permissions, moduleName)) {
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