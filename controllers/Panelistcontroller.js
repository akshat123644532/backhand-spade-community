import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Panelist from '../models/Panelistmodel.js';
import PanelQuestionnaireResponse from '../models/panelistSubmissionResponseModel.js';
import EmailTemplate from '../models/Emailtemplatemodel.js';
import RewardSetting from '../models/rewardSettingModel.js'; 
import { sendEmail } from '../config/mailer.js';
import { encryptId } from '../utils/Encryptionhelper.js';
import { verifyRecaptcha } from '../utils/Recaptchahelper.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';
import { sendTransactionalEmail } from '../services/emailServices.js';
import PanelistLoginDetails from '../models/panelistLoginDetailsModel.js';
import PanelistSignupDetails from '../models/panelistSignupDetailsModel.js';
import { checkIpFraud } from '../utils/scamalyticsHelper.js';
import { getDeviceInfo } from '../utils/deviceInfoHelper.js';
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

const linkifyPlainTextUrls = (text) => {
    if (!text) return text;
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    return text.replace(
        urlRegex,
        (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
    );
};

export const signup = async (req, res) => {
    try {
        const { name, email, password, phone, recaptchaToken } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required!"
            });
        }

        const existingPanelist = await Panelist.findByEmail(email);

        if (existingPanelist) {
            return res.status(409).json({
                success: false,
                message: "Email already registered!"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const activation_token = crypto.randomBytes(32).toString('hex');

        const activation_token_expires = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

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

        const userAgent = req.headers['user-agent'] || '';

        const forwarded = req.headers['x-forwarded-for'];

        const ip = forwarded
            ? forwarded.split(',')[0].trim()
            : req.socket?.remoteAddress || req.ip || null;

        let fraudData = null;

        try {
            fraudData = await checkIpFraud(ip);
        } catch (error) {
            console.error('Scamalytics signup error:', error.message);
        }

        const deviceInfo = getDeviceInfo(userAgent);


        try {
            await PanelistSignupDetails.create({
                panelist_id: panelistId,
                ip_address: fraudData?.ip || ip,
                user_agent: userAgent,
                browser: deviceInfo?.browser || null,
                browser_version: deviceInfo?.browser_version || null,
                os: deviceInfo?.os || null,
                os_version: deviceInfo?.os_version || null,
                device_type: deviceInfo?.device_type || null,
                device_name: deviceInfo?.device_name || null,
                fraud_score: fraudData?.scamalytics_score ?? null,
                fraud_risk: fraudData?.scamalytics_risk ?? null,
                vpn: fraudData?.is_vpn ?? 0,
                tor: 0,
                proxy: fraudData?.is_resproxy ?? 0,
                datacenter: fraudData?.is_datacenter ?? 0,
                country: fraudData?.ip_country_name ?? null,
                country_code: fraudData?.ip_country_code ?? null,
                state: fraudData?.ip_state_name ?? null,
                city: fraudData?.ip_city ?? null,
                postal_code: null,
                latitude: null,
                longitude: null,
                asn: null,
                isp_name: fraudData?.scamalytics_isp ?? null,
                organization_name: fraudData?.scamalytics_org ?? null
            });

            console.log('Panelist signup details saved successfully');
        } catch (signupDetailsError) {
            console.error(
                'Panelist signup details save failed:',
                signupDetailsError
            );
        }

        const encryptedUserId = encryptId(panelistId);

        await Panelist.setQuestionnaireUrl(
            panelistId,
            encryptedUserId
        );

        // Registration and questionnaire points are credited after questionnaire completion.
        const settings = await RewardSetting.get();

        const rewardPoints =
            settings?.registration_reward_points || 200;

        await addRewardPoints({
            user_id: panelistId,
            points: rewardPoints,
            transaction_type: 'credit',
            transaction_by: 'Admin',
            remark: 'Registration Reward',
            reference_id: null,
            comment: 'Welcome bonus on signup'
        });

        const baseUrl = (
            process.env.CLIENT_BASE_URL ||
            'https://spadecommunity.com'
        ).replace(/\/$/, '');

        const questionnaireLink =
            `${baseUrl}/community-users?Userid=${encryptedUserId}`;

        let emailWarning = null;

        try {
            const template =
                await EmailTemplate.getByKey('Panelist Questionnaire');

            if (!template) {
                emailWarning =
                    'Panelist Questionnaire email template not found or inactive.';
            } else {
                const { subject, body } =
                    EmailTemplate.render(template, {
                        name,
                        questionnaire_link: questionnaireLink
                    });

                // const htmlBody =
                //     linkifyPlainTextUrls(body);

                const result = await sendTransactionalEmail({
                    toEmail: email,
                    toName: name,
                    subject,
                    htmlBody: body
                });
                if (!result) {
                    emailWarning = result.error || 'Signup email could not be sent.';
                } else {
                    console.log(`EMAIL SENT TO: ${email} ✅`);
                }
            }
        } catch (mailError) {
            emailWarning =
                mailError?.message ||
                'Signup email could not be sent.';

            console.error(
                'SIGNUP EMAIL SEND FAILED:',
                emailWarning
            );
        }

        return res.status(201).json({
            success: true,
            message: emailWarning
                ? 'Signup successful, but we could not send the questionnaire email.'
                : 'Signup successful! Please check your email.',
            ...(emailWarning && {
                email_warning: emailWarning
            }),
            data: {
                questionnaire_url:
                    `/community-users?Userid=${encryptedUserId}`
            }
        });

    } catch (error) {
        console.error("SIGNUP ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
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
            return res.status(400).json({
                success: false,
                message: "Email and password are required!"
            });
        }

        const panelist = await Panelist.findByEmail(email);

        if (!panelist) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password!"
            });
        }

        if (!panelist.is_verified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email before logging in!"
            });
        }

        if (panelist.questionnaire !== 'yes') {
            return res.status(403).json({
                success: false,
                message: "Please complete your panel questionnaire to finish registration before logging in!",
                data: {
                    questionnaire_url: `/community-users?Userid=${panelist.questionnaire_url}`
                }
            });
        }

        const isMatch = await bcrypt.compare(password, panelist.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password!"
            });
        }

        const userAgent = req.headers['user-agent'] || '';

        const forwarded = req.headers['x-forwarded-for'];

        const ip = forwarded
            ? forwarded.split(',')[0].trim()
            : req.socket?.remoteAddress || req.ip || null;

        let fraudData = null;

        try {
            fraudData = await checkIpFraud(ip);
        } catch (error) {
            console.error('Scamalytics error:', error.message);
        }

        const deviceInfo = getDeviceInfo(userAgent);

        

        try {
            await PanelistLoginDetails.create({
                panelist_id: panelist.id,

                ip_address: fraudData?.ip || ip,

                user_agent: userAgent,

                browser: deviceInfo?.browser || null,
                browser_version: deviceInfo?.browser_version || null,

                os: deviceInfo?.os || null,
                os_version: deviceInfo?.os_version || null,

                device_type: deviceInfo?.device_type || null,
                device_name: deviceInfo?.device_name || null,

                fraud_score: fraudData?.scamalytics_score ?? null,
                fraud_risk: fraudData?.scamalytics_risk ?? null,

                vpn: fraudData?.is_vpn ?? 0,
                tor: 0,
                proxy: fraudData?.is_resproxy ?? 0,
                datacenter: fraudData?.is_datacenter ?? 0,

                country: fraudData?.ip_country_name ?? null,
                country_code: fraudData?.ip_country_code ?? null,
                state: fraudData?.ip_state_name ?? null,
                city: fraudData?.ip_city ?? null,

                postal_code: null,
                latitude: null,
                longitude: null,
                asn: null,

                isp_name: fraudData?.scamalytics_isp ?? null,
                organization_name: fraudData?.scamalytics_org ?? null
            });

            // console.log('Panelist login details saved successfully');
        } catch (loginDetailsError) {
            console.error(
                'Panelist login details save failed:',
                loginDetailsError
            );
        }

        const token = jwt.sign(
            {
                id: panelist.id,
                email: panelist.email,
                name: panelist.name,
                role: 'panelist'
            },
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
        console.error('Panelist login error:', error);

        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};
export const getAllPanelists = async (req, res) => {
    try {
        const panelists = await Panelist.getAll();

        return res.status(200).json({
            success: true,
            data: panelists.data.map((panelist) => serializePanelistImage(panelist, req))
        });
    } catch (error) {
        console.error('GET ALL PANELISTS ERROR:', error);

        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};

// Returns filled questionnaire (question + answer) too
// ─────────────────────────────────────────────────────────
// ✅ FIXED — now returns filled questionnaire (question + answer) too
// ─────────────────────────────────────────────────────────
export const getPanelistById = async (req, res) => {
    try {
        const { id } = req.params;

        const panelist = await Panelist.findById(id);
        if (!panelist) return res.status(404).json({ success: false, message: "Panelist not found!" });

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
    <p><a href="${questionnaireLink}" target="_blank" rel="noopener noreferrer">Click here to fill your questionnaire.</a></p>
    <p>Questionnaire link: <a href="${questionnaireLink}" target="_blank" rel="noopener noreferrer">${questionnaireLink}</a></p>
    <p>(If you run into any problems, simply copy and paste the entire link into your web browser.)</p>
    <p>Thank You,<br/>Spade Community</p>
`;

// Single panelist: resend the questionnaire/invite email
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

// =====================================================
// EXPORT PANELISTS CSV
// =====================================================
export const exportPanelistsCsv = async (req, res) => {
    try {
        // console.log("🔥 EXPORT API HIT");

        const search = (req.query.search || '').trim();
        const status = req.query.status || '';

        const is_verified =
            req.query.is_verified !== undefined
                ? req.query.is_verified
                : '';

        const questionnaire = req.query.questionnaire || '';

        const rows = await Panelist.getAllForExport({
            search,
            status,
            is_verified,
            questionnaire
        });

        const csv = buildCsv(rows, [
            { label: 'ID', key: 'id' },
            { label: 'Name', key: 'name' },
            { label: 'Email address', key: 'email' },
            { label: 'Created at', key: 'created_at' },
            { label: 'Status', key: 'status' }
        ]);

        return sendCsv(
            res,
            'panelists.csv',
            csv
        );

    } catch (error) {
        console.error('exportPanelistsCsv error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error!',
            error: error.message
        });
    }
};

// Multiple panelists: bulk invite/resend, per-panelist error isolation
export const sendBulkInviteEmails = async (req, res) => {
    try {
        const { ids } = req.body; // e.g. [80, 82, 85]

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

export const getSignupDetails = async (req, res) => {
    try {
        const { id } = req.params || req.query;
        if (!id) return res.status(400).json({ success: false, message: "ID is required!" });
        const panelistDetails = await Panelist.getSignupDetailsById(id);
        if (!panelistDetails) return res.status(404).json({ success: false, message: "Panelist or Detailsnot found!" });
        return res.status(200).json({ success: true, data: panelistDetails });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getLoginDetails = async (req, res) => {
    try {
        const { id } = req.params || req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID is required!"
            });
        }

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);

        const loginDetails = await Panelist.getLoginDetailsById(
            id,
            page,
            limit
        );

        if (!loginDetails) {
            return res.status(404).json({
                success: false,
                message: "Panelist or Details not found!"
            });
        }

        return res.status(200).json({
            success: true,
            data: loginDetails
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};