import express from 'express';
import verifyToken from '../Middleware/authMiddleware.js';

import {
    addSurvey,
    getAllSurveys,
    getSurveyById,
    updateSurvey,
    deleteSurvey,
    searchSurveys,
    getEligiblePartners,
    assignPartners,
    getAssignedPartners,
    removePartner,
    updatePartnerAllocation,
    addRecontact,
    getAllRecontacts,
    getSurveyRecontacts
} from '../controllers/surveyController.js';

const router = express.Router();

router.post('/add', verifyToken, addSurvey);
router.post('/add/:groupId', verifyToken, addSurvey);
router.post('/recontact/add', verifyToken, addRecontact);
router.get('/list', verifyToken, getAllSurveys);
router.get('/recontact/list', verifyToken, getAllRecontacts);
router.get('/search', verifyToken, searchSurveys);

router.get('/:id/recontacts', verifyToken, getSurveyRecontacts);
router.get('/:id/eligible-partners', verifyToken, getEligiblePartners);
router.post('/:id/assign-partners', verifyToken, assignPartners);
router.get('/:id/partners', verifyToken, getAssignedPartners);
router.delete('/:id/partners/:partnerId', verifyToken, removePartner);
router.patch('/:id/partners/:partnerId/allocation', verifyToken, updatePartnerAllocation);

router.get('/:id', verifyToken, getSurveyById);
router.put('/:id', verifyToken, updateSurvey);
router.delete('/:id', verifyToken, deleteSurvey);

export default router;