import Admin from '../models/adminModel.js';
import { decodePermissions } from '../utils/permissionsHelper.js';

// GET /api/permissions/download-access
// Poore modules ka { moduleName: true/false } map return karta hai.
// Frontend page/app load pe ek baar call kare, aur us map ke hisaab se
// har module page pe "Download CSV" button show/hide kare.
export const getDownloadAccess = async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized!" });
        }

        const admin = await Admin.getById(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found!" });
        }

        const permissions = decodePermissions(admin.permissions);
        const downloadAccessMap = {};
        permissions.forEach((p) => {
            downloadAccessMap[p.module] = !!p.csv_download;
        });

        return res.status(200).json({ success: true, data: downloadAccessMap });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// GET /api/permissions/download-access/:module
// Ek specific module ka check
export const checkModuleDownloadAccess = async (req, res) => {
    try {
        const adminId = req.user?.id;
        const { module } = req.params;
        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized!" });
        }
        if (!module) {
            return res.status(400).json({ success: false, message: "Module name is required!" });
        }

        const admin = await Admin.getById(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found!" });
        }

        const permissions = decodePermissions(admin.permissions);
        const modulePerm = permissions.find(
            (p) => (p.module || '').toLowerCase() === module.toLowerCase()
        );
        const hasAccess = !!(modulePerm && modulePerm.csv_download);

        return res.status(200).json({ success: true, module, csv_download: hasAccess });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};