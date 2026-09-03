import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { checkCsvDownloadPermission } from '../middleware/checkCsvDownloadPermission.js';
import {
    addLibraryQuestion,
    getAllLibraryQuestions,
    getLibraryQuestionById,
    getLibraryQuestionsByLanguage,
    updateLibraryQuestion,
    updateLibraryQuestionSortOrder,
    toggleLibraryQuestionStatus,
    deleteLibraryQuestion,
    exportLibraryQuestionsCsv
} from '../controllers/Questionlibrarycontroller.js';
import {
    validateAddLibraryQuestion,
    validateUpdateLibraryQuestion,
    validateLibraryQuestionId,
    validateToggleStatus,
    validateGetAllLibraryQuestions,
    validateGetByLanguage
} from '../validations/Questionlibraryvalidations.js';

const router = express.Router();

router.post('/add',                 verifyToken, validateAddLibraryQuestion,     addLibraryQuestion);
router.get('/list',                 verifyToken, validateGetAllLibraryQuestions, getAllLibraryQuestions);
router.get('/export/csv',           verifyToken, checkCsvDownloadPermission('QuestionLibrary'), exportLibraryQuestionsCsv);
router.get('/language/:language',   verifyToken, validateGetByLanguage,          getLibraryQuestionsByLanguage);
router.put('/sort-order',           verifyToken,                                 updateLibraryQuestionSortOrder);
router.get('/:id',                  verifyToken, validateLibraryQuestionId,      getLibraryQuestionById);
router.put('/:id',                  verifyToken, validateUpdateLibraryQuestion,  updateLibraryQuestion);
router.patch('/:id/status',         verifyToken, validateToggleStatus,           toggleLibraryQuestionStatus);
router.delete('/:id',               verifyToken, validateLibraryQuestionId,      deleteLibraryQuestion);
export default router;