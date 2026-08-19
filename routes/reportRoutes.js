import express from 'express';
import { getProjectReport, downloadProjectReportCsv } from '../controllers/reportController.js';
import verifyToken from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/project/:id/report', verifyToken, getProjectReport);


router.get('/project/:id/report/export/csv', verifyToken, downloadProjectReportCsv);

export default router;