import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/checkPermission.js';
import {
    addQuestionnaireGroup,
    getAllQuestionnaireGroups,
    getQuestionnaireGroupById,
    getGroupQuestions,
    submitGroupAnswers,
    updateQuestionnaireGroup,
    toggleStatus,
    deleteQuestionnaireGroup,
    exportQuestionnaireGroupsCsv
} from '../controllers/Questionnairegroupcontroller.js';
import {
    validateAddQuestionnaireGroup,
    validateUpdateQuestionnaireGroup,
    validateQuestionnaireGroupId,
    validateToggleStatus,
    validateGetAllQuestionnaireGroups
} from '../validations/Questionnairegroupvalidations.js';

const router = express.Router();

router.post('/add',                     verifyToken, validateAddQuestionnaireGroup,     addQuestionnaireGroup);
router.get('/list',                     verifyToken, validateGetAllQuestionnaireGroups, getAllQuestionnaireGroups);
router.get('/export/csv',               verifyToken, checkPermission('QuestionnaireGroup', 'csv_download'), exportQuestionnaireGroupsCsv);
router.get('/public/:id/questions',     getGroupQuestions);
router.post('/public/:id/submit',       submitGroupAnswers);
router.get('/:id',                      verifyToken, validateQuestionnaireGroupId,      getQuestionnaireGroupById);
router.put('/:id',                      verifyToken, validateUpdateQuestionnaireGroup,  updateQuestionnaireGroup);
router.patch('/:id/status',             verifyToken, validateToggleStatus,              toggleStatus);
router.delete('/:id',                   verifyToken, validateQuestionnaireGroupId,      deleteQuestionnaireGroup);
export default router;