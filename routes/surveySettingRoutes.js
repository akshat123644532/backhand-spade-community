import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import {
    getAllSurveySettings,
    getSurveySettingById,
    getSurveySettingByLanguage,
    addSurveySetting,
    updateSurveySetting,
    deleteSurveySetting
} from '../controllers/surveySettingController.js';

const router = express.Router();


router.get('/public/language/:language', getSurveySettingByLanguage);


router.get('/list', verifyToken, getAllSurveySettings);
router.get('/:id', verifyToken, getSurveySettingById);
router.post('/add', verifyToken, addSurveySetting);
router.put('/:id', verifyToken, updateSurveySetting);
router.delete('/:id', verifyToken, deleteSurveySetting);

export default router;