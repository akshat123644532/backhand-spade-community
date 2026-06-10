import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addSurveyGroup,
    getAllSurveyGroups,
    getSurveyGroupById,
    updateSurveyGroup,
    toggleStatus,
    deleteSurveyGroup
} from '../controllers/surveyGroupController.js';

const router = express.Router();

router.post('/add', verifyToken, addSurveyGroup);
router.get('/list', verifyToken, getAllSurveyGroups);
router.get('/:id', verifyToken, getSurveyGroupById);
router.put('/:id', verifyToken, updateSurveyGroup);
router.patch('/:id/status', verifyToken, toggleStatus);
router.delete('/:id', verifyToken, deleteSurveyGroup);

export default router;