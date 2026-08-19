import express from 'express';
import { 
    getProjectReport, 
    downloadProjectReportCsv 
} from '../controllers/reportController.js'; 

const router = express.Router();

router.get('/:id/report', getProjectReport);
router.get('/:id/report/export/csv', downloadProjectReportCsv);

export default router;