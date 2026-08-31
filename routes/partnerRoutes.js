import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
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
const canReadPartners = [verifyToken, allowRoles('admin', 'project_manager')];
const requireAdmin = [verifyToken, allowRoles('admin')];

router.post('/add', ...requireAdmin, addPartner);
router.get('/list', ...canReadPartners, getAllPartners);
router.get('/panel-sizes', ...canReadPartners, getPartnerPanelSizes);
router.get('/export/csv', ...requireAdmin, exportPartnersCsv);
router.get('/:id', ...canReadPartners, getPartnerById);
router.put('/:id', ...requireAdmin, updatePartner);
router.delete('/:id', ...requireAdmin, deletePartner);
export default router;
