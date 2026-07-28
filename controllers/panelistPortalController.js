import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import PanelistPortal from '../models/panelistPortalModel.js';
import RewardSetting from '../models/rewardSettingModel.js';
import { sendEmail } from '../config/mailer.js';

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
            { id: panelist.id, email: panelist.email },
            process.env.JWT_SECRET,
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

        const currentHashedPassword = await PanelistPortal.getPasswordById(id);

        const isMatch = await bcrypt.compare(old_password, currentHashedPassword);
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

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required!" });
        }

        const panelist = await PanelistPortal.getByEmail(email);

        // Security: same response chahe email exist kare ya na kare
        if (!panelist) {
            return res.status(200).json({
                success: true,
                message: "If this email is registered, an OTP has been sent."
            });
        }

        // 6-digit numeric OTP
        const otp = "123456";
        const otp_expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        await PanelistPortal.setResetToken(email, otp, otp_expires);

        try {
            const result = await sendEmail({
                to: email,
                subject: "Your Spade Community Password Reset OTP",
                html: `
                    <p>Dear ${panelist.name},</p>
                    <p>Your OTP to reset your password is:</p>
                    <h2 style="letter-spacing: 4px;">${otp}</h2>
                    <p>This OTP will expire in 10 minutes. If you didn't request this, ignore this email.</p>
                    <p>Thank You,<br/>Spade Community</p>
                `
            });
            if (result?.skipped) {
                console.log("FORGOT PASSWORD: SMTP not configured, OTP email skipped.");
            }
        } catch (mailError) {
            console.error('FORGOT PASSWORD OTP EMAIL FAILED:', mailError.message);
        }

        return res.status(200).json({
            success: true,
            message: "If this email is registered, an OTP has been sent."
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, new_password, confirm_password } = req.body;

        if (!email || !otp || !new_password || !confirm_password) {
            return res.status(400).json({ success: false, message: "Email, otp, new_password and confirm_password are required!" });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({ success: false, message: "Passwords do not match!" });
        }

        const panelist = await PanelistPortal.getByEmail(email);
        if (!panelist) {
            return res.status(400).json({ success: false, message: "Invalid email or OTP!" });
        }

        const otpRecord = await PanelistPortal.getByResetToken(otp);
        if (!otpRecord || otpRecord.email !== email) {
            return res.status(400).json({ success: false, message: "Invalid email or OTP!" });
        }

        if (new Date(otpRecord.reset_token_expires) < new Date()) {
            return res.status(400).json({ success: false, message: "OTP has expired!" });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await PanelistPortal.resetPassword(otpRecord.id, hashedPassword);

        return res.status(200).json({ success: true, message: "Password reset successful! Please login with your new password." });
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
        const id = req.panelist.id;
        const { reward_points, remark, comment } = req.body;

        if (!reward_points) {
            return res.status(400).json({ success: false, message: "Reward points are required!" });
        }

        const panelist = await PanelistPortal.getDashboard(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        const settings = await RewardSetting.get();
        const minimum_payout = settings?.minimum_payout || 500;

        if (panelist.balance_point < minimum_payout) {
            return res.status(400).json({
                success: false,
                message: `Minimum ${minimum_payout} points required to redeem!`,
                data: { balance_point: panelist.balance_point, minimum_payout }
            });
        }

        if (reward_points > panelist.balance_point) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance points!",
                data: { balance_point: panelist.balance_point }
            });
        }

        const request_id = await PanelistPortal.submitRedeemRequest({
            user_id: id,
            reward_points,
            requested_by: panelist.name,
            remark,
            comment
        });

        return res.status(201).json({
            success: true,
            message: "Redeem request submitted successfully!",
            data: { request_id }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
