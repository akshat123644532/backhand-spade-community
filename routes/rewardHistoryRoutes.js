import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addRewardHistory, getAllRewardHistory, getRewardHistoryById } from '../controllers/rewardHistoryController.js';
import { addRedeemRequest, getAllRedeemRequests, getRedeemRequestById, updateRedeemStatus } from '../controllers/rewardRedeemController.js';

const router = express.Router();

// Reward History
router.post('/add',                     verifyToken, addRewardHistory);
router.get('/list',                     verifyToken, getAllRewardHistory);
router.get('/:id',                      verifyToken, getRewardHistoryById);

// Redeem Requests
router.post('/redeem/add',              verifyToken, addRedeemRequest);
router.get('/redeem/list',              verifyToken, getAllRedeemRequests);
router.get('/redeem/:id',              verifyToken, getRedeemRequestById);
router.patch('/redeem/:id/status',      verifyToken, updateRedeemStatus);

export default router;