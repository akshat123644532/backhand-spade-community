import express from 'express';
import {
    addSurveyActivity,
    getSurveyPreScreen,
    getSurveyLink
} from '../controllers/surveyDataController.js';

const router = express.Router();

// Public survey flow (token-based, no auth)
router.post('/activity', addSurveyActivity);
router.post('/prescreen', getSurveyPreScreen);
router.get('/prescreen', getSurveyPreScreen);
router.get('/link', getSurveyLink);

export default router;
