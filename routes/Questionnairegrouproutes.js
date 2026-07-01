import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addQuestionnaireGroup, getAllQuestionnaireGroups, getQuestionnaireGroupById, updateQuestionnaireGroup, toggleStatus, deleteQuestionnaireGroup } from '../controllers/questionnaireGroupController.js';
import { validateAddQuestionnaireGroup, validateUpdateQuestionnaireGroup, validateQuestionnaireGroupId, validateToggleStatus, validateGetAllQuestionnaireGroups } from '../validations/questionnaireGroupValidations.js';

const router = express.Router();

router.post('/add',         verifyToken, validateAddQuestionnaireGroup,     addQuestionnaireGroup);
router.get('/list',         verifyToken, validateGetAllQuestionnaireGroups, getAllQuestionnaireGroups);
router.get('/:id',          verifyToken, validateQuestionnaireGroupId,      getQuestionnaireGroupById);
router.put('/:id',          verifyToken, validateUpdateQuestionnaireGroup,  updateQuestionnaireGroup);
router.patch('/:id/status', verifyToken, validateToggleStatus,              toggleStatus);
router.delete('/:id',       verifyToken, validateQuestionnaireGroupId,      deleteQuestionnaireGroup);

export default router;

