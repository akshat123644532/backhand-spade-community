import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addSurvey,
    getAllSurveys,
    getSurveyById,
    updateSurvey,
    deleteSurvey
} from '../controllers/surveyController.js';

const router = express.Router();

router.post('/add', verifyToken, addSurvey);
router.get('/list', verifyToken, getAllSurveys);
router.get('/:id', verifyToken, getSurveyById);
router.put('/:id', verifyToken, updateSurvey);
router.delete('/:id', verifyToken, deleteSurvey);

export default router;