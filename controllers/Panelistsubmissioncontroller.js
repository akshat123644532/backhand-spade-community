import Panelist from '../models/Panelistmodel.js';
import PanelQuestionnaire from '../models/Panelquestionnairemodel.js';
import PanelistSubmissionResponse from '../models/panelistSubmissionResponseModel.js';
import { decryptId } from '../utils/Encryptionhelper.js';
import { addRewardPoints } from '../utils/rewardHelper.js';

const QUESTIONNAIRE_COMPLETION_POINTS = 200;

export const getQuestionnaireByUrl = async (req, res) => {
    try {
        const { Userid } = req.query;

        if (!Userid) {
            return res.status(400).json({ success: false, message: "Userid is required!" });
        }

        let panelistId;
        try {
            panelistId = decryptId(Userid);
        } catch (err) {
            return res.status(400).json({ success: false, message: "Invalid or tampered link!" });
        }

        const panelist = await Panelist.findById(panelistId);
        if (!panelist) {
            return res.status(404).json({ success: false, message: "Invalid questionnaire link!" });
        }

        if (panelist.questionnaire === 'yes') {
            return res.status(200).json({
                success: true,
                already_completed: true,
                message: "You have already submitted this questionnaire.",
                data: { balance_point: panelist.balance_point }
            });
        }

        const language = req.query.language || 'english';
        const questions = await PanelQuestionnaire.getByLanguage(language);

        return res.status(200).json({
            success: true,
            already_completed: false,
            panelist: { id: panelist.id, name: panelist.name },
            data: questions
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};

export const submitQuestionnaire = async (req, res) => {
    try {
        const { Userid } = req.query;
        const { answers } = req.body;

        if (!Userid) {
            return res.status(400).json({ success: false, message: "Userid is required!" });
        }

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ success: false, message: "Answers are required!" });
        }

        let panelistId;
        try {
            panelistId = decryptId(Userid);
        } catch (err) {
            return res.status(400).json({ success: false, message: "Invalid or tampered link!" });
        }

        const panelist = await Panelist.findById(panelistId);
        if (!panelist) {
            return res.status(404).json({ success: false, message: "Invalid questionnaire link!" });
        }

        if (panelist.questionnaire === 'yes') {
            return res.status(409).json({ success: false, message: "Questionnaire already submitted!" });
        }

        await PanelistSubmissionResponse.submitQuestionnaire(panelist.id, answers);

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
import { addRewardPoints } from '../utils/rewardHelper.js';
import { buildCsv, sendCsv } from '../utils/csvExport.js';
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

        const settings = await RewardSetting.get();
        const rewardPoints = settings?.registration_reward_points || 200; 

        await addRewardPoints({
    user_id: panelist.id,
    points: QUESTIONNAIRE_COMPLETION_POINTS,
    transaction_type: 'credit',
    transaction_by: 'Admin',
    remark: 'Questionnaire Completion Reward',   
    reference_id: null,
    comment: 'Reward for completing panel questionnaire'
});
        return res.status(200).json({
            success: true,
            message: `Questionnaire submitted successfully! You earned ${QUESTIONNAIRE_COMPLETION_POINTS} points.`
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
