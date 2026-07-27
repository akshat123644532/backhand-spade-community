import express from 'express';
import multer from 'multer';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import {
    login,
    getDashboard,
    getProfile,
    updateProfile,
    changePassword,
    getRewardHistory,
    getRedeemRequests,
    submitRedeemRequest
} from '../controllers/panelistPortalController.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();
const requirePanelist = [verifyToken, allowRoles('panelist')];

router.post('/login',               login);
router.get('/dashboard',            ...requirePanelist, getDashboard);
router.get('/profile',              ...requirePanelist, getProfile);
router.put('/profile',              ...requirePanelist, upload.single('photo'), updateProfile);
router.put('/change-password',      ...requirePanelist, changePassword);
router.get('/reward-history',       ...requirePanelist, getRewardHistory);
router.get('/redeem-requests',      ...requirePanelist, getRedeemRequests);
router.post('/redeem-request',      ...requirePanelist, submitRedeemRequest);

export default router;
