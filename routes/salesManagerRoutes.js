import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { checkPermission } from '../middleware/checkPermission.js';
import upload from '../middleware/uploadMiddleware.js';
import {
    loginSalesManager,
    addSalesManager,
    getAllSalesManagers,
    getSalesManagerById,
    getSelfSalesManager,
    updateSalesManager,
    toggleStatus,
    deleteSalesManager,
    exportSalesManagersCsv
} from '../controllers/salesManagerController.js';
import { validateAddSalesManager, validateUpdateSalesManager, validateSalesManagerId, validateToggleStatus, validateGetAllSalesManagers } from '../validations/salesManagerValidations.js';
import { validateImageFile } from '../middleware/imageValidationMiddleware.js';
const router = express.Router();

router.post('/login',       loginSalesManager);
router.get('/me',           verifyToken, allowRoles('sales_manager'),                                                   getSelfSalesManager);

router.post('/',            verifyToken, upload.single('profile_image'), validateImageFile, validateAddSalesManager,    addSalesManager);
router.get('/list',         verifyToken, validateGetAllSalesManagers,                                                   getAllSalesManagers);
router.get('/export/csv',   verifyToken, checkPermission('SalesManager', 'csv_download'),                               exportSalesManagersCsv);
router.get('/:id',          verifyToken, validateSalesManagerId,                                                        getSalesManagerById);
router.put('/:id',          verifyToken, upload.single('profile_image'), validateImageFile, validateUpdateSalesManager, updateSalesManager);
router.patch('/status/:id', verifyToken, validateToggleStatus,                                                          toggleStatus);
router.delete('/:id',       verifyToken, validateSalesManagerId,                                                        deleteSalesManager);
export default router;