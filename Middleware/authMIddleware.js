import jwt from 'jsonwebtoken';

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access Denied: Token not found!" });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_123_secured');
        req.user = verified;
        next();
    } catch (error) {
        res.status(403).json({ success: false, message: "Invalid or Expired Token!" });
    }
};

export default verifyToken;