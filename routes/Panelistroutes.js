import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { signup, activateAccount, login, getAllPanelists } from '../controllers/Panelistcontroller.js';

const router = express.Router();

router.post('/signup',         signup);
router.get('/activate/:token', activateAccount);
router.post('/login',          login);
router.get('/list',            verifyToken, getAllPanelists);

export default router;