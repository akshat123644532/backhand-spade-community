import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import {
    addQuestion,
    getAllQuestions,
    getQuestionById,
    getQuestionsByTitle,
    getQuestionsByLanguage,
    updateQuestion,
    updateSortOrder,
    toggleStatus,
    deleteQuestion
} from '../controllers/screeningQuestionController.js';

const router = express.Router();

router.post('/add',                     verifyToken, addQuestion);
router.get('/list',                     verifyToken, getAllQuestions);
router.put('/sort-order',               verifyToken, updateSortOrder);
router.get('/language/:language',       verifyToken, getQuestionsByLanguage);
router.get('/by-title/:question_title', verifyToken, getQuestionsByTitle);
router.get('/:id',                      verifyToken, getQuestionById);
router.put('/:id',                      verifyToken, updateQuestion);
router.patch('/:id/status',             verifyToken, toggleStatus);
router.delete('/:id',                   verifyToken, deleteQuestion);

export default router;