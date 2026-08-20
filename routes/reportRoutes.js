import express from 'express';
import {
    getProjectReport,
    downloadProjectReportCsv,
    getSupplierReport,
    downloadSupplierReportCsv
} from '../controllers/reportController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:id/report', verifyToken, getProjectReport);
router.get('/:id/report/export/csv', verifyToken, downloadProjectReportCsv);
router.get('/:projectId/supplier/:partnerId', verifyToken, getSupplierReport);
router.get('/:projectId/supplier/:partnerId/export/csv', verifyToken, downloadSupplierReportCsv);

export default router;