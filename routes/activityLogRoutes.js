import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    getAllActivityLogs,
    deleteActivityLog,
    deleteAllActivityLogs
} from '../controllers/activityLogController.js';

const router = express.Router();

router.get('/list',     verifyToken, getAllActivityLogs);
router.delete('/all',   verifyToken, deleteAllActivityLogs);
router.delete('/:id',   verifyToken, deleteActivityLog);

export default router;