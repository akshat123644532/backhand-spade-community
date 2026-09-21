import jwt from 'jsonwebtoken';
import Partner from '../models/partnerModel.js';
import { logActivity } from '../utils/activityLogger.js';
import { decrypt, encrypt, encryptPasswordForStorage, verifyPassword } from '../utils/cryptoHelper.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';
import { sendTransactionalEmail } from '../services/emailServices.js';
import EmailTemplate from '../models/Emailtemplatemodel.js';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in .env file! Application cannot start without it.');
}

const prepareApiSecretKeyForStorage = (apiSecretKey) => {
    if (apiSecretKey === undefined || apiSecretKey === null || apiSecretKey === '') {
        return apiSecretKey;
    }
    const plainSecret = decrypt(apiSecretKey);
    return encrypt(plainSecret);
};

const withDecryptedApiSecret = (partner) => {
    if (!partner?.api_secret_key) return partner;
    try {
        return {
            ...partner,
            api_secret_key: decrypt(partner.api_secret_key),
        };
    } catch (error) {
        return partner;
    }
};

const omitPassword = (partner) => {
    if (!partner) return partner;
    const { password, ...rest } = partner;
    return rest;
};

export const loginPartner = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required!" });
        }

        const partner = await Partner.findByEmailForLogin(email);
        if (!partner) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        if (partner.status !== 'active') {
            return res.status(403).json({ success: false, message: "Your account is inactive. Please contact admin." });
        }

        if (!partner.password) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        const plainPassword = decrypt(password);
        const isMatch = await verifyPassword(plainPassword, partner.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        const token = jwt.sign(
            { id: partner.id, email: partner.email, role: 'partner' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful!",
            token,
            data: {
                code: partner.code,
                name: partner.name,
                email: partner.email,
                status: partner.status
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const addPartner = async (req, res) => {
    try {
        const {
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            status, api_base_url, api_body, api_secret_key, password
        } = req.body;
        if (!name || !email) return res.status(400).json({ success: false, message: "Name and email are required!" });
        if (!password) return res.status(400).json({ success: false, message: "Password is required!" });
        if (panel_size === undefined || panel_size === null || panel_size === '') {
            return res.status(400).json({ success: false, message: "Panel size is required!" });
        }
        if (isNaN(Number(panel_size)) || Number(panel_size) < 0) {
            return res.status(400).json({ success: false, message: "Panel size must be a valid number!" });
        }

        const emailExists = await Partner.findByEmail(email);
        if (emailExists) return res.status(400).json({ success: false, message: "Partner with this email already exists!" });

        const code = await Partner.generateCode();
        const codeExists = await Partner.findByCode(code);
        if (codeExists) return res.status(400).json({ success: false, message: "Code conflict, please try again!" });

        // Client sends encrypted password → decrypt → bcrypt hash for DB (same as PM/SM/admin)
        const plainPassword = decrypt(password);
        if (!plainPassword || String(plainPassword).trim().length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters!"
            });
        }
        const hashedPassword = await encryptPasswordForStorage(plainPassword);

        const encryptedApiSecretKey = api_secret_key
            ? prepareApiSecretKeyForStorage(api_secret_key)
            : api_secret_key;

        await Partner.create({
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            code, status, api_base_url, api_body, api_secret_key: encryptedApiSecretKey,
            password: hashedPassword
        });

        await logActivity({ admin_id: req.user?.id, action: 'ADD', module: 'Partner', description: `Partner "${name}" added with code ${code}`, ip_address: req.ip });
       
        let emailWarning = null;
        try {
            const template = await EmailTemplate.getByKey('partner-welcome-email');
            if (!template) {
                emailWarning = 'Project Manager Login email template not found or inactive.';
            } else {
                const login_url = `${process.env.BASE_URL}/auth`;
                const { subject, body } = EmailTemplate.render(template, {
                    user_name: name,
                    login_url,
                    user_email: email,
                    password: plainPassword,
                });
                // console.log('DEBUG result:', result);
                // console.log('DEBUG email:', email);
                // console.log('DEBUG name:', name);
                // console.log('DEBUG subject:', subject);
                // console.log('DEBUG body:', body);
                // 🔽 Swapped: SMTP → ZeptoMail
                const result = await sendTransactionalEmail({
                    toEmail: email,
                    toName: name,
                    subject,
                    htmlBody: body.replace(/\n/g, '<br>'),
                });
                // console.log('DEBUG result:', result);
                if (!result) {
                    emailWarning = result.error || 'Welcome email could not be sent.';
                    // console.error('PROJECT MANAGER WELCOME EMAIL FAILED:', emailWarning);
                } else {
                    console.log(`PARTNER WELCOME EMAIL SENT TO: ${email} ✅`);
                }
            }
        } catch (mailError) {
            emailWarning = mailError?.message || 'Welcome email could not be sent.';
            console.error('PARTNER WELCOME EMAIL FAILED:', emailWarning);
        }

        return res.status(201).json({
            success: true,
            message: emailWarning
                ? 'Partner added successfully, but welcome email could not be sent.'
                : 'Partner added successfully!',
            ...(emailWarning && { email_warning: emailWarning }),
            data: { code, name, email },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

/** GET /api/partner/me — profile from JWT (role must be partner) */
export const getSelfPartner = async (req, res) => {
    try {
        const { id, email, role } = req.user || {};
        if (role !== 'partner' || !id) {
            return res.status(403).json({ success: false, message: "Access denied for this role!" });
        }

        const partner = await Partner.getById(id);
        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found!" });
        }

        if (email && String(partner.email).toLowerCase() !== String(email).toLowerCase()) {
            return res.status(403).json({ success: false, message: "Token email does not match partner account!" });
        }

        return res.status(200).json({
            success: true,
            message: "Partner fetched successfully!",
            data: omitPassword(withDecryptedApiSecret(partner))
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

/** PUT /api/partner/change-password — current + new + confirm (client-encrypted) */
export const changePartnerPassword = async (req, res) => {
    try {
        const { id, email, role } = req.user || {};
        if (role !== 'partner' || !id) {
            return res.status(403).json({ success: false, message: "Access denied for this role!" });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "currentPassword, newPassword and confirmPassword are required!"
            });
        }

        const plainCurrentPassword = decrypt(currentPassword);
        const plainNewPassword = decrypt(newPassword);
        const plainConfirmPassword = decrypt(confirmPassword);

        if (plainNewPassword !== plainConfirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match!"
            });
        }

        if (!plainNewPassword || String(plainNewPassword).trim().length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters!"
            });
        }

        const partner = await Partner.getByIdWithPassword(id);
        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found!" });
        }

        if (email && String(partner.email).toLowerCase() !== String(email).toLowerCase()) {
            return res.status(403).json({ success: false, message: "Token email does not match partner account!" });
        }

        if (!partner.password) {
            return res.status(400).json({ success: false, message: "Password is not set for this partner!" });
        }

        const isMatch = await verifyPassword(plainCurrentPassword, partner.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Current password is incorrect!" });
        }

        if (plainCurrentPassword === plainNewPassword) {
            return res.status(400).json({
                success: false,
                message: "New password cannot be the same as your current password!"
            });
        }

        const hashedPassword = await encryptPasswordForStorage(plainNewPassword);
        await Partner.updatePassword(id, hashedPassword);

        await logActivity({
            admin_id: id,
            action: 'CHANGE_PASSWORD',
            module: 'Partner',
            description: `Partner "${partner.name || partner.email}" changed their password`,
            ip_address: req.ip
        });

        return res.status(200).json({ success: true, message: "Password updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getAllPartners = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const status = req.query.status || '';
        const country = req.query.country || '';
        const result = await Partner.getAll({ page, limit, search, status, country });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPartnerPanelSizes = async (req, res) => {
    try {
        const partners = await Partner.getAllPanelSizes();
        return res.status(200).json({
            success: true,
            data: partners.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                panel_size: Number(p.panel_size) || 0
            }))
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const getPartnerById = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });
        return res.status(200).json({ success: true, data: withDecryptedApiSecret(partner) });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const updatePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            status, api_base_url, api_body, api_secret_key
        } = req.body;

        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });

        if (email && email !== partner.email) {
            const emailExists = await Partner.findByEmail(email);
            if (emailExists) return res.status(400).json({ success: false, message: "Email already in use!" });
        }

        const updateData = {
            name, email, contact_no, country, contact_person, website_url, panel_size,
            complete, terminate, over_quota, quality_term, survey_close, about_partner,
            status, api_base_url, api_body, api_secret_key
        };
        Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

        if (Object.prototype.hasOwnProperty.call(updateData, 'api_secret_key') && updateData.api_secret_key) {
            updateData.api_secret_key = prepareApiSecretKeyForStorage(updateData.api_secret_key);
        }

        await Partner.update(id, updateData);

        await logActivity({ admin_id: req.user?.id, action: 'UPDATE', module: 'Partner', description: `Partner ID ${id} updated`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Partner updated successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const deletePartner = async (req, res) => {
    try {
        const { id } = req.params;
        const partner = await Partner.getById(id);
        if (!partner) return res.status(404).json({ success: false, message: "Partner not found!" });

        await Partner.delete(id);

        await logActivity({ admin_id: req.user?.id, action: 'DELETE', module: 'Partner', description: `Partner ID ${id} deleted`, ip_address: req.ip });

        return res.status(200).json({ success: true, message: "Partner deleted successfully!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
export const exportPartnersCsv = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || '';
        const country = req.query.country || '';

        const result = await Partner.getAll({
            page: 1,
            limit: 1000000,
            search,
            status,
            country
        });

        const csv = buildCsv(result.data, [
            { label: 'ID', key: 'id' },
            { label: 'Code', key: 'code' },
            { label: 'Name', key: 'name' },
            { label: 'Email', key: 'email' },
            { label: 'Contact Person', key: 'contact_person' },
            { label: 'Country', key: 'country' },
            { label: 'Website URL', key: 'website_url' },
            { label: 'Panel Size', key: 'panel_size' },
            { label: 'Status', key: 'status' },
            { label: 'Created At', key: 'created_at' }
        ]);

        return sendCsv(res, 'partners.csv', csv);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error!",
            error: error.message
        });
    }
};
