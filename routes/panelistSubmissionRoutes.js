import express from 'express';
import { getQuestionnaireByUrl, submitQuestionnaire } from '../controllers/panelistSubmissionController.js';

const router = express.Router();


router.get('/:token', getQuestionnaireByUrl);
router.post('/:token/submit', submitQuestionnaire);

export default router;