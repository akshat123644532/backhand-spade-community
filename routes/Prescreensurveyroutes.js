import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addPrescreenSurvey, getAllPrescreenSurveys, getPrescreenSurveyById,
    updatePrescreenSurvey, toggleStatus, deletePrescreenSurvey
} from '../controllers/prescreenSurveyController.js';

const router = express.Router();

router.post('/add', verifyToken, addPrescreenSurvey);
router.get('/list', verifyToken, getAllPrescreenSurveys);
router.get('/:id', verifyToken, getPrescreenSurveyById);
router.put('/:id', verifyToken, updatePrescreenSurvey);
router.patch('/:id/status', verifyToken, toggleStatus);
router.delete('/:id', verifyToken, deletePrescreenSurvey);

export default router;