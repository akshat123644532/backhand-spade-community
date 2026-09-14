import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { checkCsvDownloadPermission } from '../middleware/checkCsvDownloadPermission.js';
import {
    loginPartner,
    getSelfPartner,
    changePartnerPassword,
    addPartner,
    getAllPartners,
    getPartnerPanelSizes,
    getPartnerById,
    updatePartner,
    deletePartner,
    exportPartnersCsv
} from '../controllers/partnerController.js';
const router = express.Router();

router.post('/login', loginPartner);
router.get('/me', verifyToken, allowRoles('partner'), getSelfPartner);
router.put('/change-password', verifyToken, allowRoles('partner'), changePartnerPassword);

router.post('/add', verifyToken, addPartner);
router.get('/list', verifyToken, getAllPartners);
router.get('/panel-sizes', verifyToken, getPartnerPanelSizes);
router.get('/export/csv', verifyToken, checkCsvDownloadPermission('Partners'), exportPartnersCsv);
router.get('/:id', verifyToken, getPartnerById);
router.put('/:id', verifyToken, updatePartner);
router.delete('/:id', verifyToken, deletePartner);
export default router;
