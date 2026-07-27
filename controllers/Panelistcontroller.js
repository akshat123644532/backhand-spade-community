import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Panelist from '../models/Panelistmodel.js';
import PanelQuestionnaireResponse from '../models/panelistSubmissionResponseModel.js';
import EmailTemplate from '../models/Emailtemplatemodel.js';
import { sendEmail } from '../config/mailer.js';
import { encryptId } from '../utils/Encryptionhelper.js';
import { verifyRecaptcha } from '../utils/Recaptchahelper.js';
import { addRewardPoints } from '../utils/rewardHelper.js';

const resolvePanelistImageUrl = (imageUrl, req) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('/uploads/')) {
        return `${req.protocol}://${req.get('host')}${imageUrl}`;
    }
    return imageUrl;
};

const serializePanelistImage = (panelist, req) => ({
    ...panelist,
    photo: resolvePanelistImageUrl(panelist.photo, req)
});

const buildPanelistPhotoPath = (req) => {
    if (!req.file) return null;
    return `/uploads/${req.file.filename}`;
};

export const signup = async (req, res) => {
    try {
        const { name, email, password, phone, recaptchaToken } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, email and password are required!" });
        }

        const existingPanelist = await Panelist.findByEmail(email);
        if (existingPanelist) {
            return res.status(409).json({ success: false, message: "Email already registered!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const activation_token = crypto.randomBytes(32).toString('hex');
        const activation_token_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const photoPath = buildPanelistPhotoPath(req);

        const panelistId = await Panelist.create({
            name,
            email,
            phone: phone || null,
            photo: photoPath,
            password: hashedPassword,
            activation_token,
            activation_token_expires,
            questionnaire_url: null
        });

        const encryptedUserId = encryptId(panelistId);
        await Panelist.setQuestionnaireUrl(panelistId, encryptedUserId);

        await addRewardPoints({
            user_id: panelistId,
            points: 200,
            transaction_type: 'credit',
            transaction_by: 'Admin',
            remark: 'Registration Reward',
            reference_id: null,
            comment: 'Welcome bonus on signup'
        });

        const baseUrl = (process.env.CLIENT_BASE_URL || '').replace(/\/$/, '');
        const questionnaireLink = `${baseUrl}/community-users?Userid=${encryptedUserId}`;

        let emailWarning = null;
        try {
            const template = await EmailTemplate.getByKey('Panelist Questionnaire');
            if (!template) {
                emailWarning = 'Panelist Questionnaire email template not found or inactive.';
            } else {
                const { subject, body } = EmailTemplate.render(template, {
                    name,
                    questionnaire_link: questionnaireLink
                });

                const result = await sendEmail({
                    to: email,
                    subject,
                    text: body,
                    html: body.replace(/\n/g, '<br>')
                });
                if (result?.skipped) {
                    emailWarning = 'SMTP is not configured. Signup email was skipped.';
                } else {
                    console.log(`EMAIL SENT TO: ${email} ✅`);
                }
            }
        } catch (mailError) {
            emailWarning = mailError?.message || 'Signup email could not be sent.';
            console.error('SIGNUP EMAIL SEND FAILED:', emailWarning);
        }

        return res.status(201).json({
            success: true,
            message: emailWarning
                ? 'Signup successful, but we could not send the questionnaire email.'
                : 'Signup successful! Please check your email.',
            ...(emailWarning && { email_warning: emailWarning }),
            data: { questionnaire_url: `/community-users?Userid=${encryptedUserId}` }
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

        return res.status(200).json({
            success: true,
            message: "Account activated successfully!",
            data: {
                questionnaire_url: `/community-users?Userid=${panelist.questionnaire_url}`
            }
        });

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
            { id: panelist.id, email: panelist.email, name: panelist.name, role: 'panelist' },
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
                phone: panelist.phone,
                photo: resolvePanelistImageUrl(panelist.photo, req),
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
        // ✅ FIX: trim search so leading/trailing spaces don't break full-name matches
        const search = (req.query.search || '').trim();
        const status = req.query.status || '';
        const is_verified = req.query.is_verified !== undefined ? req.query.is_verified : '';
        const questionnaire = req.query.questionnaire || '';

        const result = await Panelist.getAll({ page, limit, search, status, is_verified, questionnaire });
        result.data = result.data.map((panelist) => serializePanelistImage(panelist, req));
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ─────────────────────────────────────────────────────────
// ✅ FIXED — now returns filled questionnaire (question + answer) too
// ─────────────────────────────────────────────────────────
export const getPanelistById = async (req, res) => {
    try {
        const { id } = req.params;

        const panelist = await Panelist.findById(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        // fetch filled questionnaire answers (question + answer joined)
        const questionnaire_answers = await PanelQuestionnaireResponse.getByPanelist(id);

        return res.status(200).json({
            success: true,
            data: {
                ...serializePanelistImage(panelist, req),
                questionnaire_answers
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePanelist = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, status } = req.body;

        const panelist = await Panelist.findById(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (status !== undefined) updateData.status = status;
        if (req.file) updateData.photo = buildPanelistPhotoPath(req);

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

const buildQuestionnaireEmailHtml = (panelist, questionnaireLink) => `
    <p>Dear ${panelist.name},</p>
    <p>This is a reminder to complete your Spade Community questionnaire.</p>
    <p><a href="${questionnaireLink}">Click here to fill your questionnaire.</a></p>
    <p>Questionnaire link: ${questionnaireLink}</p>
    <p>(If you run into any problems, simply copy and paste the entire link into your web browser.)</p>
    <p>Thank You,<br/>Spade Community</p>
`;

// ✅ Single panelist — resend the questionnaire/invite email
export const resendInviteEmail = async (req, res) => {
    try {
        const { id } = req.params;

        const panelist = await Panelist.findById(id);
        if (!panelist) {
            return res.status(404).json({ success: false, message: "Panelist not found!" });
        }

        if (panelist.questionnaire === 'yes') {
            return res.status(409).json({ success: false, message: "This panelist has already completed the questionnaire!" });
        }

        let encryptedUserId = panelist.questionnaire_url;
        if (!encryptedUserId) {
            encryptedUserId = encryptId(panelist.id);
            await Panelist.setQuestionnaireUrl(panelist.id, encryptedUserId);
        }

        const questionnaireLink = `https://spade-community-client-ui.vercel.app/community-users?Userid=${encryptedUserId}`;

        const result = await sendEmail({
            to: panelist.email,
            subject: "Reminder: Complete Your Questionnaire - Spade Community",
            html: buildQuestionnaireEmailHtml(panelist, questionnaireLink)
        });

        if (result?.skipped) {
            return res.status(200).json({
                success: true,
                message: "SMTP is not configured, so the email was skipped.",
                email_warning: true
            });
        }

        return res.status(200).json({ success: true, message: `Invite email resent to ${panelist.email}!` });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

// ✅ Multiple panelists — bulk invite/resend, per-panelist error isolation
export const sendBulkInviteEmails = async (req, res) => {
    try {
        const { ids } = req.body; // array of panelist ids, e.g. [80, 82, 85]

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "ids array is required!" });
        }

        const panelists = await Panelist.findByIds(ids);
        const foundIds = panelists.map((p) => p.id);
        const notFoundIds = ids
            .map((id) => Number(id))
            .filter((id) => !foundIds.includes(id));

        const sent = [];
        const failed = [];
        const skipped = [];

        for (const panelist of panelists) {
            if (panelist.questionnaire === 'yes') {
                skipped.push({ id: panelist.id, email: panelist.email, reason: "Already completed questionnaire" });
                continue;
            }

            try {
                let encryptedUserId = panelist.questionnaire_url;
                if (!encryptedUserId) {
                    encryptedUserId = encryptId(panelist.id);
                    await Panelist.setQuestionnaireUrl(panelist.id, encryptedUserId);
                }

                const questionnaireLink = `https://spade-community-client-ui.vercel.app/community-users?Userid=${encryptedUserId}`;

                const result = await sendEmail({
                    to: panelist.email,
                    subject: "Reminder: Complete Your Questionnaire - Spade Community",
                    html: buildQuestionnaireEmailHtml(panelist, questionnaireLink)
                });

                if (result?.skipped) {
                    failed.push({ id: panelist.id, email: panelist.email, reason: "SMTP not configured" });
                } else {
                    sent.push({ id: panelist.id, email: panelist.email });
                }
            } catch (mailError) {
                failed.push({ id: panelist.id, email: panelist.email, reason: mailError.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: `Bulk invite processed: ${sent.length} sent, ${failed.length} failed, ${skipped.length} skipped, ${notFoundIds.length} not found.`,
            data: { sent, failed, skipped, not_found_ids: notFoundIds }
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};