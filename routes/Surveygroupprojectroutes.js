import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addSurveyGroupProject,
    getAllSurveyGroupProjects,
    getSurveyGroupProjectById,
    updateSurveyGroupProject,
    toggleStatus,
    deleteSurveyGroupProject,
    addSurveysToGroup,
    removeSurveyFromGroup
} from '../controllers/surveyGroupProjectController.js';

const router = express.Router();

router.post('/add',                         verifyToken, addSurveyGroupProject);
router.get('/list',                         verifyToken, getAllSurveyGroupProjects);
router.get('/:id',                          verifyToken, getSurveyGroupProjectById);
router.put('/:id',                          verifyToken, updateSurveyGroupProject);
router.patch('/:id/status',                 verifyToken, toggleStatus);
router.delete('/:id',                       verifyToken, deleteSurveyGroupProject);

router.post('/:id/surveys',                 verifyToken, addSurveysToGroup);
router.delete('/:id/surveys/:surveyId',     verifyToken, removeSurveyFromGroup);

export default router;