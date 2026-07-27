import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import PanelistPortal from '../models/panelistPortalModel.js';
import { JWT_SECRET } from '../middleware/authMiddleware.js';
import { submitRedeemRequest as submitRedeemRequestService } from '../services/panelistRedeemService.js';

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required!" });
        }

        const panelist = await PanelistPortal.getByEmail(email);
        if (!panelist) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        if (panelist.status !== 'active') {
            return res.status(403).json({ success: false, message: "Your account is not active!" });
        }

        if (panelist.questionnaire !== 'yes') {
            return res.status(403).json({
                success: false,
                message: "Please complete your questionnaire to activate login access!"
            });
        }

        const isMatch = await bcrypt.compare(password, panelist.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        const token = jwt.sign(
            { id: panelist.id, email: panelist.email, role: 'panelist' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            data: {
                token,
                panelist: {
                    id: panelist.id,
                    name: panelist.name,
                    email: panelist.email
                }
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getDashboard = async (req, res) => {
    try {
        const id = req.panelist.id;
        const panelist = await PanelistPortal.getDashboard(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        return res.status(200).json({
            success: true,
            data: {
                id: panelist.id,
                name: panelist.name,
                email: panelist.email,
                phone: panelist.phone,
                photo: panelist.photo,
                balance_point: panelist.balance_point,
                status: panelist.status,
                questionnaire: panelist.questionnaire,
                member_since: panelist.created_at
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        const id = req.panelist.id;
        const panelist = await PanelistPortal.getDashboard(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });
        return res.status(200).json({ success: true, data: panelist });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updateProfile = async (req, res) => {
    try {
        const id = req.panelist.id;
        const { name, phone } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;

        if (req.file) {
            updateData.photo = req.file.path;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        await PanelistPortal.updateProfile(id, updateData);
        return res.status(200).json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const changePassword = async (req, res) => {
    try {
        const id = req.panelist.id;
        const { old_password, new_password, confirm_password } = req.body;

        if (!old_password || !new_password || !confirm_password) {
            return res.status(400).json({ success: false, message: "All fields are required!" });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({ success: false, message: "New password and confirm password do not match!" });
        }

        const panelist = await PanelistPortal.getDashboard(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        const storedPassword = await PanelistPortal.getPasswordById(id);
        if (!storedPassword) {
            return res.status(404).json({ success: false, message: "Panelist not found!" });
        }

        const isMatch = await bcrypt.compare(old_password, storedPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Old password is incorrect!" });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await PanelistPortal.changePassword(id, hashedPassword);

        return res.status(200).json({ success: true, message: "Password changed successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getRewardHistory = async (req, res) => {
    try {
        const id = req.panelist.id;
        const { page, limit } = req.query;
        const result = await PanelistPortal.getRewardHistory(id, { page, limit });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getRedeemRequests = async (req, res) => {
    try {
        const id = req.panelist.id;
        const { page, limit } = req.query;
        const result = await PanelistPortal.getRedeemRequests(id, { page, limit });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const submitRedeemRequest = async (req, res) => {
    try {
        const { reward_points, remark, comment } = req.body;
        const result = await submitRedeemRequestService({
            userId: req.panelist.id,
            reward_points,
            remark,
            comment
        });

        return res.status(201).json({
            success: true,
            message: "Redeem request submitted successfully!",
            data: result
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                message: error.message,
                ...(error.data && { data: error.data })
            });
        }
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
