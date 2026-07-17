import jwt from 'jsonwebtoken';

// Comment: Unify with panelistAuthMiddleware into one auth middleware with role checks to avoid duplicate patterns and behavior drift.
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access Denied: Token not found!" });
    }

    try {
        // Comment - remove the fall back secret key always keep it in .env file.
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_123_secured');
        req.user = verified;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Unauthorized: Invalid or Expired Token!" });
    }
};

export default verifyToken;