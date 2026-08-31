import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { getSystemSettings, updateSystemSettings } from '../controllers/systemSettingController.js';

const router = express.Router();
const requireAdmin = [verifyToken, allowRoles('admin')];

router.get('/', ...requireAdmin, getSystemSettings);
router.put('/', ...requireAdmin, updateSystemSettings);

export default router;
