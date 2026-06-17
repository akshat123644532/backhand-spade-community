import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addSurvey,
    getAllSurveys,
    getSurveyById,
    updateSurvey,
    deleteSurvey,
    getEligiblePartners,
    assignPartners,
    getAssignedPartners,
    removePartner,
    updatePartnerAllocation
} from '../controllers/surveyController.js';

const router = express.Router();

router.post('/add',                                        verifyToken, addSurvey);
router.get('/list',                                        verifyToken, getAllSurveys);
router.get('/:id',                                         verifyToken, getSurveyById);
router.put('/:id',                                         verifyToken, updateSurvey);
router.delete('/:id',                                      verifyToken, deleteSurvey);

router.get('/:id/eligible-partners',                       verifyToken, getEligiblePartners);
router.post('/:id/assign-partners',                        verifyToken, assignPartners);
router.get('/:id/partners',                                verifyToken, getAssignedPartners);
router.delete('/:id/partners/:partnerId',                  verifyToken, removePartner);
router.patch('/:id/partners/:partnerId/allocation',        verifyToken, updatePartnerAllocation);

export default router;