import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addRewardHistory, getAllRewardHistory, getRewardHistoryById } from '../controllers/rewardHistoryController.js';

const router = express.Router();

router.post('/add',  verifyToken, addRewardHistory);
router.get('/list',  verifyToken, getAllRewardHistory);
router.get('/:id',   verifyToken, getRewardHistoryById);

export default router;