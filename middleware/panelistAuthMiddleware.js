import jwt from 'jsonwebtoken';

// Comment: Duplicate of authMiddleware — merge into a shared middleware with role checks; keep secret handling consistent (no fallback vs fallback drift).
const verifyPanelistToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access Denied: Token not found!" });
    }

    try {
        // Comment: Align with authMiddleware secret policy — require JWT_SECRET from env and fail if missing (no silent insecure defaults).
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.panelist = verified;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid or Expired Token!" });
    }
};

export default verifyPanelistToken;