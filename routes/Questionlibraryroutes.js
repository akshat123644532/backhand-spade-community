import express from 'express';
import verifyToken from '../middleware/authMIddleware.js';
import {
    addLibraryQuestion,
    getAllLibraryQuestions,
    getLibraryQuestionById,
    getLibraryQuestionsByLanguage,
    updateLibraryQuestion,
    updateLibraryQuestionSortOrder,
    toggleLibraryQuestionStatus,
    deleteLibraryQuestion
} from '../controllers/questionLibraryController.js';
import {
    validateAddLibraryQuestion,
    validateUpdateLibraryQuestion,
    validateLibraryQuestionId,
    validateToggleStatus,
    validateGetAllLibraryQuestions,
    validateGetByLanguage
} from '../validations/questionLibraryValidations.js';

const router = express.Router();

router.post('/add',                 verifyToken, validateAddLibraryQuestion,     addLibraryQuestion);
router.get('/list',                 verifyToken, validateGetAllLibraryQuestions, getAllLibraryQuestions);
router.get('/language/:language',   verifyToken, validateGetByLanguage,          getLibraryQuestionsByLanguage);
router.put('/sort-order',           verifyToken,                                 updateLibraryQuestionSortOrder);
router.get('/:id',                  verifyToken, validateLibraryQuestionId,      getLibraryQuestionById);
router.put('/:id',                  verifyToken, validateUpdateLibraryQuestion,  updateLibraryQuestion);
router.patch('/:id/status',         verifyToken, validateToggleStatus,           toggleLibraryQuestionStatus);
router.delete('/:id',               verifyToken, validateLibraryQuestionId,      deleteLibraryQuestion);

export default router;

