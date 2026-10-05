import Panelist from '../models/Panelistmodel.js';
import PanelQuestionnaire from '../models/Panelquestionnairemodel.js';
import PanelistSubmissionResponse from '../models/panelistSubmissionResponseModel.js';
import RewardSetting from '../models/rewardSettingModel.js';
import { decryptId } from '../utils/Encryptionhelper.js';
import { addRewardPoints } from '../utils/rewardHelper.js';



const DEFAULT_QUESTIONNAIRE_POINTS = 200;

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

        // 1) Pehle answers save. Yahan error aaya to neeche points credit nahi honge.
        await PanelistSubmissionResponse.submitQuestionnaire(panelist.id, answers);

<<<<<<< Updated upstream
        await addRewardPoints({
            user_id: panelist.id,
            points: QUESTIONNAIRE_COMPLETION_POINTS,
            transaction_type: 'credit',
            transaction_by: 'Admin',
            remark: 'Registration Reward',
            reference_id: null,
            comment: 'Reward for completing panel questionnaire'
        });
=======
        // 2) Admin settings se points lo
        const settings = await RewardSetting.get();

        const registrationPoints = Number(
            settings?.registration_reward_points ?? DEFAULT_REGISTRATION_POINTS
        ) || 0;

        const questionnairePoints = Number(
            settings?.questionnaire_reward_points ?? DEFAULT_QUESTIONNAIRE_POINTS
        ) || 0;

        // 3) Questionnaire complete hone ke baad hi dono rewards credit
        if (registrationPoints > 0) {
            await addRewardPoints({
                user_id: panelist.id,
                points: registrationPoints,
                transaction_type: 'credit',
                transaction_by: 'Admin',
                remark: 'Registration Reward',
                reference_id: null,
                comment: 'Welcome bonus, credited after questionnaire completion'
            });
        }

        if (questionnairePoints > 0) {
            await addRewardPoints({
                user_id: panelist.id,
                points: questionnairePoints,
                transaction_type: 'credit',
                transaction_by: 'Admin',
                remark: 'Questionnaire Completion Reward',
                reference_id: null,
                comment: 'Reward for completing panel questionnaire'
            });
        }

        const totalPoints = registrationPoints + questionnairePoints;
>>>>>>> Stashed changes

        return res.status(200).json({
            success: true,
            message: totalPoints > 0
                ? `Questionnaire submitted successfully! You earned ${totalPoints} points.`
                : 'Questionnaire submitted successfully!'
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};
