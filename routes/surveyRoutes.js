import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addSurvey, getAllSurveys, getSurveyById, updateSurvey, deleteSurvey, searchSurveys, getEligiblePartners, assignPartners, getAssignedPartners, removePartner, updatePartnerAllocation, addRecontact, getAllRecontacts, getSurveyRecontacts } from '../controllers/surveyController.js';
import { validateAddSurvey, validateUpdateSurvey, validateSurveyId, validateGetAllSurveys, validateSearchSurveys, validateAssignPartners, validatePartnerAllocation, validateAddRecontact } from '../validations/surveyValidations.js';

const router = express.Router();

router.post('/add',                                 verifyToken, validateAddSurvey,          addSurvey);
router.post('/add/:groupId',                        verifyToken, validateAddSurvey,          addSurvey);
router.post('/recontact/add',                       verifyToken, validateAddRecontact,       addRecontact);
router.get('/list',                                 verifyToken, validateGetAllSurveys,      getAllSurveys);
router.get('/recontact/list',                       verifyToken,                             getAllRecontacts);
router.get('/search',                               verifyToken, validateSearchSurveys,      searchSurveys);

router.get('/:id/recontacts',                       verifyToken, validateSurveyId,           getSurveyRecontacts);
router.get('/:id/eligible-partners',                verifyToken, validateSurveyId,           getEligiblePartners);
router.post('/:id/assign-partners',                 verifyToken, validateAssignPartners,     assignPartners);
router.get('/:id/partners',                         verifyToken, validateSurveyId,           getAssignedPartners);
router.delete('/:id/partners/:partnerId',           verifyToken, validateSurveyId,           removePartner);
router.patch('/:id/partners/:partnerId/allocation', verifyToken, validatePartnerAllocation,  updatePartnerAllocation);

router.get('/:id',    verifyToken, validateSurveyId,     getSurveyById);
router.put('/:id',    verifyToken, validateUpdateSurvey, updateSurvey);
router.delete('/:id', verifyToken, validateSurveyId,     deleteSurvey);

export default router;

