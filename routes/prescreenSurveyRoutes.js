import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addPrescreenSurvey, getAllPrescreenSurveys, getPrescreenSurveyById, updatePrescreenSurvey, toggleStatus, deletePrescreenSurvey } from '../controllers/prescreenSurveyController.js';
import { validateAddPrescreenSurvey, validateUpdatePrescreenSurvey, validatePrescreenSurveyId, validateToggleStatus, validateGetAllPrescreenSurveys } from '../validations/prescreenSurveyValidations.js';

const router = express.Router();

router.post('/add',         verifyToken, validateAddPrescreenSurvey,     addPrescreenSurvey);
router.get('/list',         verifyToken, validateGetAllPrescreenSurveys, getAllPrescreenSurveys);
router.get('/:id',          verifyToken, validatePrescreenSurveyId,      getPrescreenSurveyById);
router.put('/:id',          verifyToken, validateUpdatePrescreenSurvey,  updatePrescreenSurvey);
router.patch('/:id/status', verifyToken, validateToggleStatus,           toggleStatus);
router.delete('/:id',       verifyToken, validatePrescreenSurveyId,      deletePrescreenSurvey);

export default router;

