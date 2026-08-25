import express from 'express';
import {
    addSurveyActivity,
    getSurveyPreScreen,
    getSurveyLink,
    completeSurvey,
    terminateSurvey,
    quotaFullSurvey,
    qualityTermSurvey,
    surveyClosedSurvey,
    savePreScreenResponse,
    updatePreScreenResponseStatus
} from '../controllers/surveyDataController.js';

const router = express.Router();

// Public survey flow (token-based, no auth)
router.post('/activity', addSurveyActivity);
router.post('/prescreen', getSurveyPreScreen);
router.get('/prescreen', getSurveyPreScreen);
router.get('/link', getSurveyLink);

router.get('/complete', completeSurvey);
router.get('/terminate', terminateSurvey);
router.get('/quota', quotaFullSurvey);
router.get('/quality', qualityTermSurvey);
router.get('/closed', surveyClosedSurvey);

router.post('/complete', completeSurvey);
router.post('/terminate', terminateSurvey);
router.post('/quota', quotaFullSurvey);
router.post('/quality', qualityTermSurvey);
router.post('/closed', surveyClosedSurvey);

router.post('/prescreenResponse', savePreScreenResponse);
router.get('/prescreenResponseEnd', updatePreScreenResponseStatus);

export default router;
