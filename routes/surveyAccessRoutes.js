import express from 'express';
import { sendSurveyAccessOtp, verifySurveyAccessOtp } from '../controllers/surveyAccessController.js';

const router = express.Router();

router.post('/send-otp', sendSurveyAccessOtp);
router.post('/verify-otp', verifySurveyAccessOtp);

export default router;
