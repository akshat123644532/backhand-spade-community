import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import PanelistPortal from '../models/panelistPortalModel.js';
import { submitRedeemRequest as submitRedeemRequestService } from '../services/panelistRedeemService.js';
import { sendEmail } from '../config/mailer.js';
import PanelistLoginDetails from '../models/panelistLoginDetailsModel.js';
import { checkIpFraud } from '../utils/scamalyticsHelper.js';
import { getDeviceInfo } from '../utils/deviceInfoHelper.js';
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required.'
            });
        }

        const panelist = await PanelistPortal.getByEmail(email);

        if (!panelist) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        if (panelist.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive.'
            });
        }

        if (panelist.questionnaire !== 'yes') {
            return res.status(403).json({
                success: false,
                message: 'Questionnaire access is not enabled for this account.'
            });
        }

        const isMatch = await bcrypt.compare(password, panelist.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const token = jwt.sign(
            {
                id: panelist.id,
                email: panelist.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        const userAgent = req.headers['user-agent'] || '';

        const forwarded = req.headers['x-forwarded-for'];

        const ip =
            forwarded
                ? forwarded.split(',')[0].trim()
                : req.socket?.remoteAddress || req.ip || null;

        let fraudData = null;

        try {
            fraudData = await checkIpFraud(ip);
        } catch (error) {
            fraudData = null;
        }

        const deviceInfo = getDeviceInfo(userAgent);

        try {
            await PanelistLoginDetails.create({
                panelist_id: panelist.id,

                ip_address: fraudData?.ip || ip,

                user_agent: userAgent,

                browser: deviceInfo.browser,
                browser_version: deviceInfo.browser_version,

                os: deviceInfo.os,
                os_version: deviceInfo.os_version,

                device_type: deviceInfo.device_type,
                device_name: deviceInfo.device_name,

                fraud_score: fraudData?.scamalytics_score,
                fraud_risk: fraudData?.scamalytics_risk,

                vpn: fraudData?.is_vpn,
                tor: false,
                proxy: fraudData?.is_resproxy,
                datacenter: fraudData?.is_datacenter,

                country: fraudData?.ip_country_name,
                country_code: fraudData?.ip_country_code,
                state: fraudData?.ip_state_name,
                city: fraudData?.ip_city,

                postal_code: null,
                latitude: null,
                longitude: null,

                asn: null,

                isp_name: fraudData?.scamalytics_isp,
                organization_name: fraudData?.scamalytics_org
            });
        } catch (loginDetailsError) {
            console.error(
                'Panelist login details save failed:',
                loginDetailsError.message
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful!',
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
        console.error('Panelist login error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
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
        if (!currentHashedPassword) {
            return res.status(404).json({ success: false, message: "Panelist not found!" });
        }

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

        const result = await submitRedeemRequestService({
            userId: id,
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
        const status = error.status || 500;
        return res.status(status).json({
            success: false,
            message: error.status ? error.message : "Server error!",
            ...(error.data && { data: error.data }),
            ...(status === 500 && { error: error.message })
        });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required!"
            });
        }

        const panelist = await PanelistPortal.getByEmail(email);

        if (!panelist) {
            return res.status(404).json({
                success: false,
                message: "Email not registered!"
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otp_expires = new Date(Date.now() + 10 * 60 * 1000);

        await PanelistPortal.setResetToken(email, otp, otp_expires);

        const emailText = `Dear ${panelist.name},

We received a request to reset the password for your Spade Community account.

Your One-Time Password (OTP) is:

${otp}

Please enter this OTP to continue with the password reset process.

This OTP is valid for 10 minutes only. For your security, please do not share this OTP with anyone.

If you did not request a password reset, please ignore this email. Your account will remain secure.

Thank You,
Spade Community`;

        const emailHtml = `
            <p>Dear ${panelist.name},</p>

            <p>We received a request to reset the password for your Spade Community account.</p>

            <p>Your One-Time Password (OTP) is:</p>

            <h2>${otp}</h2>

            <p>Please enter this OTP to continue with the password reset process.</p>

            <p>This OTP is valid for <strong>10 minutes only</strong>. For your security, please do not share this OTP with anyone.</p>

            <p>If you did not request a password reset, please ignore this email. Your account will remain secure.</p>

            <p>Thank You,<br>Spade Community</p>
        `;

        await sendEmail({
            to: email,
            subject: "Your OTP for Password Reset - Spade Community",
            html: emailHtml,
            text: emailText
        });

        return res.status(200).json({
            success: true,
            message: "OTP has been sent to your registered email."
        });
    } catch (error) {
        console.error("FORGOT PASSWORD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP are required!" });
        }

        const otpRecord = await PanelistPortal.getByResetToken(otp);
        if (!otpRecord || otpRecord.email !== email) {
            return res.status(400).json({ success: false, message: "Invalid email or OTP!" });
        }

        if (new Date(otpRecord.reset_token_expires) < new Date()) {
            return res.status(400).json({ success: false, message: "OTP has expired!" });
        }

        // Mark OTP as verified (if you have this method in your model)
        // await PanelistPortal.markOTPVerified(otp);

        return res.status(200).json({ success: true, message: "OTP verified successfully!" });
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

        const otpRecord = await PanelistPortal.getByResetToken(otp);
        if (!otpRecord || otpRecord.email !== email) {
            return res.status(400).json({ success: false, message: "Invalid email or OTP!" });
        }

        if (new Date(otpRecord.reset_token_expires) < new Date()) {
            return res.status(400).json({ success: false, message: "OTP has expired!" });
        }

        // Get panelist to fetch old password
        const panelist = await PanelistPortal.getByEmail(email);
        if (!panelist) {
            return res.status(404).json({ success: false, message: "Panelist not found!" });
        }

        // Check if new password is same as old password
        const isSameAsOldPassword = await bcrypt.compare(new_password, panelist.password);
        if (isSameAsOldPassword) {
            return res.status(400).json({ success: false, message: "New password cannot be the same as your old password!" });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await PanelistPortal.resetPassword(otpRecord.id, hashedPassword);

        return res.status(200).json({ success: true, message: "Password reset successful! Please login with your new password." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};