import TokenBlacklist from '../models/tokenBlacklistModel.js';
import jwt from 'jsonwebtoken';

export const logout = async (req, res) => {
    try {
        const token = req.token;
        const decoded = jwt.decode(token);
        const expiresAt = new Date(decoded.exp * 1000);

        await TokenBlacklist.add(token, expiresAt);

        return res.status(200).json({ success: true, message: "Logged out successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};