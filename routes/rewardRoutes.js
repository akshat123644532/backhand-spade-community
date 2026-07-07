import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addTransaction, getAllTransactions, getTransactionById, deleteTransaction } from '../controllers/rewardTransactionController.js';
import { addRedeemRequest, getAllRedeemRequests, getRedeemRequestById, updateRedeemStatus } from '../controllers/rewardRedeemController.js';

const router = express.Router();

// Transactions
router.post('/transactions/add',        verifyToken, addTransaction);
router.get('/transactions/list',        verifyToken, getAllTransactions);
router.get('/transactions/:id',         verifyToken, getTransactionById);
router.delete('/transactions/:id',      verifyToken, deleteTransaction);

// Redeem Requests
router.post('/redeem/add',              verifyToken, addRedeemRequest);
router.get('/redeem/list',              verifyToken, getAllRedeemRequests);
router.get('/redeem/:id',               verifyToken, getRedeemRequestById);
router.patch('/redeem/:id/status',      verifyToken, updateRedeemStatus);

export default router;