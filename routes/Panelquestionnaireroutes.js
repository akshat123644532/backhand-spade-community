import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import {
    addPanelQuestion,
    getAllPanelQuestions,
    getPanelQuestionById,
    getPanelQuestionsByTitle,
    getPanelQuestionsByLanguage,
    updatePanelQuestion,
    updatePanelQuestionSortOrder,
    togglePanelQuestionStatus,
    deletePanelQuestion
} from '../controllers/Panelquestionnairecontroller.js';
const router = express.Router();

router.post('/add',                     verifyToken, addPanelQuestion);
router.get('/list',                     verifyToken, getAllPanelQuestions);
router.put('/sort-order',               verifyToken, updatePanelQuestionSortOrder);
router.get('/language/:language',       verifyToken, getPanelQuestionsByLanguage);
router.get('/by-title/:question_title', verifyToken, getPanelQuestionsByTitle);
router.get('/:id',                      verifyToken, getPanelQuestionById);
router.put('/:id',                      verifyToken, updatePanelQuestion);
router.patch('/:id/status',             verifyToken, togglePanelQuestionStatus);
router.delete('/:id',                   verifyToken, deletePanelQuestion);

export default router;