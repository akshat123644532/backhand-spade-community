import express from 'express';
import { getQuestionnaireByUrl, submitQuestionnaire } from '../controllers/Panelistsubmissioncontroller.js';

const router = express.Router();


router.get('/', getQuestionnaireByUrl);
router.post('/submit', submitQuestionnaire);

export default router;