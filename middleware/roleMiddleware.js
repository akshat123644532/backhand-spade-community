/**
 * Role gate for authenticated requests.
 *
 * Admin JWTs historically omit `role`. Treat a missing role as `admin` so
 * existing admin sessions keep working until they re-login (new tokens include
 * `role: 'admin'`). Project Manager / Sales Manager / Panelist tokens always
 * set an explicit role, so they are never mistaken for admin.
 *
 * @param {...string} roles
 */
export const allowRoles = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(403).json({ success: false, message: "Access denied for this role!" });
    }

    const role = req.user.role ?? 'admin';
    if (!roles.includes(role)) {
        return res.status(403).json({ success: false, message: "Access denied for this role!" });
    }

    next();
};
