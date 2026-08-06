import crypto from 'crypto';
import { sendEmail } from '../config/mailer.js';
import OTP from '../models/otpModel.js';
import Panelist from '../models/Panelistmodel.js';
import ProjectMultipleUrl from '../models/projectMultipleUrlModel.js';
import { encryptId, decryptId } from '../utils/Encryptionhelper.js';

const OTP_TTL_MS = 10 * 60 * 1000;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

const isEmailEligible = async (email) => {
    const panelist = await Panelist.findByEmailInsensitive(email);
    if (panelist) return true;
    return ProjectMultipleUrl.existsByVenderUserName(email);
};

/** POST /api/survey-access/send-otp  { email } */
export const sendSurveyAccessOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required!' });
        }

        const eligible = await isEmailEligible(email);
        if (!eligible) {
            return res.status(404).json({
                success: false,
                message: 'Email not found in panelists or multi-link records!'
            });
        }

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        await OTP.create(email, otp, expiresAt);

        const tempToken = encryptId(JSON.stringify({ email, purpose: 'survey_access' }));

        await sendEmail({
            to: email,
            subject: 'Survey Access OTP - Spade Community',
            text: `Your OTP for survey access is: ${otp}. This code is valid for 10 minutes only.`,
            html: `<p>Your OTP for survey access is: <strong>${otp}</strong>.</p><p>This code is valid for <strong>10 minutes</strong> only.</p>`
        });

        return res.status(200).json({
            success: true,
            message: 'OTP has been sent to your email!',
            data: {
                tempToken,
                expiresInMinutes: 10
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error!', error: error.message });
    }
};

/** POST /api/survey-access/verify-otp  { otp, tempToken } */
export const verifySurveyAccessOtp = async (req, res) => {
    try {
        const { otp, tempToken } = req.body || {};

        if (!otp || !tempToken) {
            return res.status(400).json({
                success: false,
                message: 'otp and tempToken are required!'
            });
        }

        let email;
        try {
            const payload = JSON.parse(decryptId(tempToken));
            email = normalizeEmail(payload?.email);
            if (payload?.purpose && payload.purpose !== 'survey_access') {
                return res.status(400).json({ success: false, message: 'Invalid tempToken!' });
            }
        } catch {
            return res.status(400).json({ success: false, message: 'Invalid or corrupted tempToken!' });
        }

        if (!email) {
            return res.status(400).json({ success: false, message: 'Invalid tempToken payload!' });
        }

        const otpRecord = await OTP.findValidOTP(email, String(otp).trim());
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid OTP!' });
        }

        if (new Date() > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ success: false, message: 'OTP has expired! Please request a new one.' });
        }

        if (Number(otpRecord.is_verified) === 1) {
            return res.status(400).json({ success: false, message: 'OTP already used!' });
        }

        await OTP.markVerified(otpRecord.otp_id);

        const links = await ProjectMultipleUrl.getByVenderUserName(email);
        if (!links.length) {
            return res.status(404).json({
                success: false,
                message: 'No VenderURL found for this email!'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully!',
            data: {
                email,
                links: links.map((row) => ({
                    id: row.id,
                    project_id: row.project_id,
                    project_url_id: row.project_url_id,
                    Live_Link: row.Live_Link,
                    VenderURL: row.VenderURL,
                    Status: row.Status
                })),
                // Convenience: newest matching link
                VenderURL: links[0].VenderURL
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error!', error: error.message });
    }
};
