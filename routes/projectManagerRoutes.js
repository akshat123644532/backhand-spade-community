import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import {
    loginProjectManager,
    addProjectManager,
    getAllProjectManagers,
    getProjectManagerById,
    getSelfProjectManager,
    updateProjectManager,
    toggleStatus,
    deleteProjectManager,
    exportProjectManagersCsv
} from '../controllers/projectManagerController.js';
import { validateAddProjectManager, validateUpdateProjectManager, validateProjectManagerId, validateToggleStatus, validateGetAllProjectManagers } from '../validations/projectManagerValidations.js';
import { validateImageFile } from '../middleware/imageValidationMiddleware.js';

const router = express.Router();
const requireAdmin = [verifyToken, allowRoles('admin')];

router.post('/login', loginProjectManager);
router.get('/me', verifyToken, allowRoles('project_manager'), getSelfProjectManager);

router.post('/add', ...requireAdmin, upload.single('profile_image'), validateImageFile, validateAddProjectManager, addProjectManager);
router.get('/list', ...requireAdmin, validateGetAllProjectManagers, getAllProjectManagers);
router.get('/export/csv', ...requireAdmin, exportProjectManagersCsv);
router.get('/:id', ...requireAdmin, validateProjectManagerId, getProjectManagerById);
router.put('/:id', ...requireAdmin, upload.single('profile_image'), validateImageFile, validateUpdateProjectManager, updateProjectManager);
router.patch('/:id/status', ...requireAdmin, validateToggleStatus, toggleStatus);
router.delete('/:id', ...requireAdmin, validateProjectManagerId, deleteProjectManager);
export default router;
