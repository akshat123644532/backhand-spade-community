import express from 'express';
import multer from 'multer';
import verifyPanelistToken from '../middleware/panelistAuthMiddleware.js';
import {
    login,
    getDashboard,
    getProfile,
    updateProfile,
    changePassword,
    getRewardHistory,
    getPanelistSurveys,
    getRedeemRequests,
    submitRedeemRequest,
    forgotPassword,
    verifyOTP,
    resetPassword
} from '../controllers/panelistPortalController.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/login',               login); 

router.post('/forgot-password',     forgotPassword);
router.post('/verify-otp',          verifyOTP);
router.post('/reset-password',      resetPassword);

router.get('/dashboard',            verifyPanelistToken, getDashboard);
router.get('/surveys',              verifyPanelistToken, getPanelistSurveys);
router.get('/profile',              verifyPanelistToken, getProfile);
router.put('/profile',              verifyPanelistToken, upload.single('photo'), updateProfile);
router.put('/change-password',      verifyPanelistToken, changePassword);
router.get('/reward-history',       verifyPanelistToken, getRewardHistory);
router.get('/redeem-requests',      verifyPanelistToken, getRedeemRequests);
router.post('/redeem-request',      verifyPanelistToken, submitRedeemRequest);

export default router;