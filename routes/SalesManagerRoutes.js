import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import upload from '../Middleware/uploadMiddleware.js';
import { addSalesManager, getAllSalesManagers, getSalesManagerById, updateSalesManager, toggleStatus, deleteSalesManager } from '../controllers/salesManagerController.js';
import { validateAddSalesManager, validateUpdateSalesManager, validateSalesManagerId, validateToggleStatus, validateGetAllSalesManagers } from '../validations/salesManagerValidations.js';
import { validateImageFile } from '../Middleware/imageValidationMiddleware.js';

const router = express.Router();

router.post('/',            verifyToken, upload.single('profile_image'), validateImageFile, validateAddSalesManager,    addSalesManager);
router.get('/list',         verifyToken, validateGetAllSalesManagers,                                                   getAllSalesManagers);
router.get('/:id',          verifyToken, validateSalesManagerId,                                                        getSalesManagerById);
router.put('/:id',          verifyToken, upload.single('profile_image'), validateImageFile, validateUpdateSalesManager, updateSalesManager);
router.patch('/status/:id', verifyToken, validateToggleStatus,                                                          toggleStatus);
router.delete('/:id',       verifyToken, validateSalesManagerId,                                                        deleteSalesManager);

export default router;