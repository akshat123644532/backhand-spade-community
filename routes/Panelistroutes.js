import express from 'express';
import { signup, activateAccount, login } from '../controllers/panelistController.js';

const router = express.Router();

router.post('/signup', signup);
router.get('/activate/:token', activateAccount);
router.post('/login', login);

export default router;