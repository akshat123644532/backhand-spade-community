import express from 'express';
import {
    getProjectReport,
    downloadProjectReportCsv,
    getSupplierReport,
    downloadSupplierReportCsv,
    getPreScreenReport,
    exportPreScreenReport
} from '../controllers/reportController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:id/report', verifyToken, getProjectReport);
router.get('/:id/report/export/csv', verifyToken, downloadProjectReportCsv);
router.get('/:projectId/supplier/:partnerId', verifyToken, getSupplierReport);
router.get('/:projectId/supplier/:partnerId/export/csv', verifyToken, downloadSupplierReportCsv);
router.get('/pre-screen-report', verifyToken, getPreScreenReport);
router.get('/pre-screen-report/export/csv', verifyToken, exportPreScreenReport);
export default router;