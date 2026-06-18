import express from 'express';
import verifyToken from '../Middleware/authMiddleware.js';
import { getSurveyPage, updateSurveyPage } from '../controllers/surveyPageController.js';

const router = express.Router();

router.get('/:id', verifyToken, getSurveyPage);
router.put('/:id', verifyToken, updateSurveyPage);

export default router;