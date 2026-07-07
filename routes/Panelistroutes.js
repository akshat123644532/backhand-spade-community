import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { signup, activateAccount, login, getAllPanelists, getPanelistById, updatePanelist, deletePanelist, toggleStatus } from '../controllers/Panelistcontroller.js';

const router = express.Router();

router.post('/signup',         signup);
router.get('/activate/:token', activateAccount);
router.post('/login',          login);
router.get('/list',            verifyToken, getAllPanelists);
router.get('/:id',             verifyToken, getPanelistById);
router.put('/:id',             verifyToken, updatePanelist);
router.delete('/:id',          verifyToken, deletePanelist);
router.patch('/:id/status',    verifyToken, toggleStatus);

export default router;