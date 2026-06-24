import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getSurveyPage, updateSurveyPage } from '../controllers/surveyPageController.js';
import { validateSurveyPageId, validateUpdateSurveyPage } from '../validations/surveyPageValidations.js';

const router = express.Router();

router.get('/:id', verifyToken, validateSurveyPageId,     getSurveyPage);
router.put('/:id', verifyToken, validateUpdateSurveyPage, updateSurveyPage);

export default router;

