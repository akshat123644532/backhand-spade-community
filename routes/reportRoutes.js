import express from 'express';
import { getProjectReport, downloadProjectReportCsv } from '../controllers/reportController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:id/report', verifyToken, getProjectReport);
router.get('/:id/report/export/csv', verifyToken, downloadProjectReportCsv);

export default router;