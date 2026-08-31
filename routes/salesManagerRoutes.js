import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
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
const requireAdmin = [verifyToken, allowRoles('admin')];

router.post('/login', loginSalesManager);
router.get('/me', verifyToken, allowRoles('sales_manager'), getSelfSalesManager);

router.post('/', ...requireAdmin, upload.single('profile_image'), validateImageFile, validateAddSalesManager, addSalesManager);
router.get('/list', ...requireAdmin, validateGetAllSalesManagers, getAllSalesManagers);
router.get('/export/csv', ...requireAdmin, exportSalesManagersCsv);
router.get('/:id', ...requireAdmin, validateSalesManagerId, getSalesManagerById);
router.put('/:id', ...requireAdmin, upload.single('profile_image'), validateImageFile, validateUpdateSalesManager, updateSalesManager);
router.patch('/status/:id', ...requireAdmin, validateToggleStatus, toggleStatus);
router.delete('/:id', ...requireAdmin, validateSalesManagerId, deleteSalesManager);
export default router;
