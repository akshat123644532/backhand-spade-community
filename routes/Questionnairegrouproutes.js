import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { 
    addQuestionnaireGroup, 
    getAllQuestionnaireGroups, 
    getQuestionnaireGroupById, 
    getGroupQuestions,
    updateQuestionnaireGroup, 
    toggleStatus, 
    deleteQuestionnaireGroup 
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
router.get('/public/:id/questions',     getGroupQuestions);  // ✅ No token - public route
router.get('/:id',                      verifyToken, validateQuestionnaireGroupId,      getQuestionnaireGroupById);
router.put('/:id',                      verifyToken, validateUpdateQuestionnaireGroup,  updateQuestionnaireGroup);
router.patch('/:id/status',             verifyToken, validateToggleStatus,              toggleStatus);
router.delete('/:id',                   verifyToken, validateQuestionnaireGroupId,      deleteQuestionnaireGroup);

export default router;

