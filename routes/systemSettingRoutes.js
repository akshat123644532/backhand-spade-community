import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getSystemSettings, updateSystemSettings } from '../controllers/systemSettingController.js';

const router = express.Router();

router.get('/', verifyToken, getSystemSettings);
router.put('/', verifyToken, updateSystemSettings);

export default router;