import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { getDownloadAccess, checkModuleDownloadAccess } from '../controllers/permissionController.js';

const router = express.Router();

router.get('/download-access', verifyToken, getDownloadAccess);
router.get('/download-access/:module', verifyToken, checkModuleDownloadAccess);

export default router;