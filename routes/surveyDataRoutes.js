import express from 'express';
import {
    addSurveyActivity,
    getSurveyPreScreen,
    getSurveyLink,
    updateSurveyStatus
} from '../controllers/surveyDataController.js';

const router = express.Router();

// Public survey flow (token-based, no auth)
router.post('/activity', addSurveyActivity);
router.post('/prescreen', getSurveyPreScreen);
router.get('/prescreen', getSurveyPreScreen);
router.get('/link', getSurveyLink);
router.post('/status', updateSurveyStatus);
router.get('/status', updateSurveyStatus);

export default router;
