import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/checkPermission.js';
import {
    addPartner,
    getAllPartners,
    getPartnerPanelSizes,
    getPartnerById,
    updatePartner,
    deletePartner,
    exportPartnersCsv
} from '../controllers/partnerController.js';
const router = express.Router();

router.post('/add', verifyToken, addPartner);
router.get('/list', verifyToken, getAllPartners);
router.get('/panel-sizes', verifyToken, getPartnerPanelSizes);
router.get('/export/csv', verifyToken, checkPermission('Partners', 'csv_download'), exportPartnersCsv);
router.get('/:id', verifyToken, getPartnerById);
router.put('/:id', verifyToken, updatePartner);
router.delete('/:id', verifyToken, deletePartner);
export default router;

