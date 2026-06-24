import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addSurveyGroupProject, getAllSurveyGroupProjects, getSurveyGroupProjectById, updateSurveyGroupProject, toggleStatus, deleteSurveyGroupProject, addSurveysToGroup, removeSurveyFromGroup } from '../controllers/surveyGroupProjectController.js';
import { validateAddSurveyGroupProject, validateUpdateSurveyGroupProject, validateSurveyGroupProjectId, validateToggleStatus, validateGetAllSurveyGroupProjects, validateAddSurveysToGroup, validateRemoveSurveyFromGroup } from '../validations/surveyGroupProjectValidations.js';

const router = express.Router();

router.post('/add',                     verifyToken, validateAddSurveyGroupProject,    addSurveyGroupProject);
router.get('/list',                     verifyToken, validateGetAllSurveyGroupProjects, getAllSurveyGroupProjects);
router.get('/:id',                      verifyToken, validateSurveyGroupProjectId,     getSurveyGroupProjectById);
router.put('/:id',                      verifyToken, validateUpdateSurveyGroupProject, updateSurveyGroupProject);
router.patch('/:id/status',             verifyToken, validateToggleStatus,             toggleStatus);
router.delete('/:id',                   verifyToken, validateSurveyGroupProjectId,     deleteSurveyGroupProject);
router.post('/:id/surveys',             verifyToken, validateAddSurveysToGroup,        addSurveysToGroup);
router.delete('/:id/surveys/:surveyId', verifyToken, validateRemoveSurveyFromGroup,   removeSurveyFromGroup);

export default router;


