import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getSettings, updateSettings } from '../controllers/rewardSettingController.js';

const router = express.Router();

router.get('/get',    verifyToken, getSettings);
router.put('/update', verifyToken, updateSettings);

export default router;