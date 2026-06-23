import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import { addSalesLog, getSalesLogs, getSalesLogById, updateSalesLog, deleteSalesLog } from '../controllers/salesLogController.js';
import { validateAddSalesLog, validateUpdateSalesLog, validateSalesLogId } from '../validations/salesLogValidations.js';

const router = express.Router();

router.post('/:id/add',         verifyToken, validateAddSalesLog,    addSalesLog);
router.get('/:id/list',         verifyToken, getSalesLogs);
router.get('/:id/view/:logId',  verifyToken, validateSalesLogId,     getSalesLogById);
router.put('/:id/:logId',       verifyToken, validateUpdateSalesLog, updateSalesLog);
router.delete('/:id/:logId',    verifyToken, validateSalesLogId,     deleteSalesLog);

export default router;