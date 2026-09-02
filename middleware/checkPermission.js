import Permission from '../models/permissionModel.js';

// Usage: checkPermission('ProjectManager', 'read')
export const checkPermission = (moduleName, action = 'read') => async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Unauthorized!" });
        }

        // Super admin bypass — agar permission_type field token mein nahi hai
        // (purana token), toh yeh false rahega aur neeche DB check chalega,
        // jo bina kisi row ke false hi return karega -> 403.
        // Naye token mein permission_type honi zaroori hai admin bypass ke liye.
        if (req.user.permission_type === 'admin') return next();

        const allowed = await Permission.check(req.user.id, moduleName, action);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: `You don't have permission to access ${moduleName}!`
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};