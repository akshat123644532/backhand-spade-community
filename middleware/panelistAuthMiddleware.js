import jwt from 'jsonwebtoken';

const verifyPanelistToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access Denied: Token not found!" });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.panelist = verified;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid or Expired Token!" });
    }
};

export default verifyPanelistToken;