import Panelist from '../models/Panelistmodel.js';
import PanelQuestionnaire from '../models/Panelquestionnairemodel.js';
import PanelistSubmissionResponse from '../models/panelistSubmissionResponseModel.js';
import { decryptId } from '../utils/Encryptionhelper.js';

// Points credited to a panelist's balance when they complete the questionnaire.
// Change this value if sir wants a different reward amount.
const QUESTIONNAIRE_COMPLETION_POINTS = 50.00;

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
        const { answers } = req.body; // [{ question_id, answer }, ...]

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
        // Comment - use transaction to save response 
        await PanelistSubmissionResponse.saveResponses(panelist.id, answers);
        // Comment - since both query are pointing to same table combine both query in single transaction.
        await Panelist.markQuestionnaireCompleted(panelist.id);
        await Panelist.addBalancePoints(panelist.id, QUESTIONNAIRE_COMPLETION_POINTS);

        return res.status(200).json({
            success: true,
            message: `Questionnaire submitted successfully! You earned ${QUESTIONNAIRE_COMPLETION_POINTS} points.`
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error!", error: error.message });
    }
};