import Panelist from '../models/panelistModel.js';
import PanelQuestionnaire from '../models/panelQuestionnaireModel.js';
import PanelistSubmissionResponse from '../models/panelistSubmissionResponseModel.js';

// Points credited to a panelist's balance when they complete the questionnaire.
// Change this value if sir wants a different reward amount.
const QUESTIONNAIRE_COMPLETION_POINTS = 50.00;

export const getQuestionnaireByUrl = async (req, res) => {
    try {
        const { token } = req.params;

        const panelist = await Panelist.findByQuestionnaireUrl(token);
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
        const { token } = req.params;
        const { answers } = req.body; // [{ question_id, answer }, ...]

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ success: false, message: "Answers are required!" });
        }

        const panelist = await Panelist.findByQuestionnaireUrl(token);
        if (!panelist) {
            return res.status(404).json({ success: false, message: "Invalid questionnaire link!" });
        }

        if (panelist.questionnaire === 'yes') {
            return res.status(409).json({ success: false, message: "Questionnaire already submitted!" });
        }

        await PanelistSubmissionResponse.saveResponses(panelist.id, answers);
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