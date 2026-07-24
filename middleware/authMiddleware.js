import jwt from 'jsonwebtoken';
import TokenBlacklist from '../models/tokenBlacklistModel.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in .env file! Application cannot start without it.');
}

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access Denied: Token not found!" });
    }

    try {
        const blacklisted = await TokenBlacklist.isBlacklisted(token);
        if (blacklisted) {
            return res.status(401).json({ success: false, message: "Unauthorized: Token has been logged out!" });
        }

        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Unauthorized: Invalid or Expired Token!" });
    }
};

export default verifyToken;
