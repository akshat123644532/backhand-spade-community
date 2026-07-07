import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Panelist from '../models/Panelistmodel.js';
import transporter from '../config/mailer.js';
import { encryptId } from '../utils/Encryptionhelper.js';
import { verifyRecaptcha } from '../utils/Recaptchahelper.js';
import { addRewardPoints } from '../utils/rewardHelper.js';

export const signup = async (req, res) => {
    try {
        const { name, email, password, recaptchaToken } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, email and password are required!" });
        }

        // if (!recaptchaToken) {
        //     return res.status(400).json({ success: false, message: "reCAPTCHA verification is required!" });
        // }
        // const isHuman = await verifyRecaptcha(recaptchaToken);
        // if (!isHuman) {
        //     return res.status(400).json({ success: false, message: "reCAPTCHA verification failed. Please try again!" });
        // }

        const existingPanelist = await Panelist.findByEmail(email);
        if (existingPanelist) {
            return res.status(409).json({ success: false, message: "Email already registered!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const activation_token = crypto.randomBytes(32).toString('hex');
        const activation_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const panelistId = await Panelist.create({
            name,
            email,
            password: hashedPassword,
            activation_token,
            activation_token_expires,
            questionnaire_url: null
        });

        const encryptedUserId = encryptId(panelistId);
        await Panelist.setQuestionnaireUrl(panelistId, encryptedUserId);

        // ✅ Auto reward transaction
        await addRewardPoints({
            user_id: panelistId,
            points: 200,
            transaction_type: 'credit',
            transaction_by: 'Admin',
            remark: 'Registration Reward',
            reference_id: null,
            comment: 'Welcome bonus on signup'
        });

        const activationLink = `https://spade-community-client-ui.vercel.app/activate/${activation_token}`;
        const questionnaireLink = `https://spade-community-client-ui.vercel.app/community-users?Userid=${encryptedUserId}`;

        res.status(201).json({
            success: true,
            message: "Signup successful! Please check your email to activate your account.",
            data: { questionnaire_url: `/community-users?Userid=${encryptedUserId}` }
        });

        transporter.sendMail({
            from: `"Spade Community" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Activate Your Spade Community Account",
            html: `
                <p>Dear ${name},</p>
                <p>You recently signed up with Spade Community.</p>
                <p>Please click on the Activation link below to verify your email id.</p>
                <p><a href="${activationLink}">Click here to activate your account.</a></p>
                <p>Activation link: ${activationLink}</p>
                <p>Once activated, you can fill out your panel questionnaire here to start earning points:</p>
                <p><a href="${questionnaireLink}">Click here to fill your questionnaire.</a></p>
                <p>(If you run into any problems, simply copy and paste the entire link into your web browser.)</p>
                <p>By clicking above you will be helping to ensure the highest deliverability of future emails. If you ever change your mind, just let us know by sending mail to support@spade-community.com and we'll stop sending you emails immediately.</p>
                <p>Thank You,<br/>Spade Community</p>
            `
        }).catch((err) => {
            console.error("SIGNUP EMAIL SEND FAILED:", err);
        });

    } catch (error) {
        console.error("SIGNUP ERROR:", error);
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const activateAccount = async (req, res) => {
    try {
        const { token } = req.params;

        const panelist = await Panelist.findByToken(token);
        if (!panelist) {
            return res.status(400).json({ success: false, message: "Invalid or already used activation link!" });
        }

        if (new Date(panelist.activation_token_expires) < new Date()) {
            return res.status(400).json({ success: false, message: "Activation link expired!" });
        }

        await Panelist.activatePanelist(panelist.id);
        return res.status(200).json({ success: true, message: "Account activated successfully! You can now login." });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required!" });
        }

        const panelist = await Panelist.findByEmail(email);
        if (!panelist) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        if (!panelist.is_verified) {
            return res.status(403).json({ success: false, message: "Please verify your email before logging in!" });
        }

        if (panelist.questionnaire !== 'yes') {
            return res.status(403).json({
                success: false,
                message: "Please complete your panel questionnaire to finish registration before logging in!",
                data: { questionnaire_url: `/community-users?Userid=${panelist.questionnaire_url}` }
            });
        }

        const isMatch = await bcrypt.compare(password, panelist.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        const token = jwt.sign(
            { id: panelist.id, email: panelist.email, name: panelist.name },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            token,
            data: {
                id: panelist.id,
                name: panelist.name,
                email: panelist.email,
                balance_point: panelist.balance_point,
                questionnaire: panelist.questionnaire,
                questionnaire_url: `/community-users?Userid=${panelist.questionnaire_url}`
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllPanelists = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const is_verified = req.query.is_verified !== undefined ? req.query.is_verified : '';
        const questionnaire = req.query.questionnaire || '';

        const result = await Panelist.getAll({ page, limit, search, status, is_verified, questionnaire });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePanelist = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, status } = req.body;

        const panelist = await Panelist.findById(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (status !== undefined) updateData.status = status;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: false, message: "Nothing to update!" });
        }

        await Panelist.update(id, updateData);
        return res.status(200).json({ success: true, message: "Panelist updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deletePanelist = async (req, res) => {
    try {
        const { id } = req.params;

        const panelist = await Panelist.findById(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        await Panelist.delete(id);
        return res.status(200).json({ success: true, message: "Panelist deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be active or inactive!" });
        }

        const panelist = await Panelist.findById(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        await Panelist.toggleStatus(id, status);
        return res.status(200).json({ success: true, message: `Status updated to ${status}!` });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};