import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addSalesLog,
    getSalesLogs,
    updateSalesLog,
    deleteSalesLog
} from '../controllers/salesLogController.js';

const router = express.Router();

router.post('/:id/add',      verifyToken, addSalesLog);
router.get('/:id/list',      verifyToken, getSalesLogs);
router.put('/:id/:logId',    verifyToken, updateSalesLog);
router.delete('/:id/:logId', verifyToken, deleteSalesLog);

export default router;