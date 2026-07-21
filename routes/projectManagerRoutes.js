import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import { loginProjectManager, addProjectManager, getAllProjectManagers, getProjectManagerById, getSelfProjectManager, updateProjectManager, toggleStatus, deleteProjectManager } from '../controllers/projectManagerController.js';
import { validateAddProjectManager, validateUpdateProjectManager, validateProjectManagerId, validateToggleStatus, validateGetAllProjectManagers } from '../validations/projectManagerValidations.js';
import { validateImageFile } from '../middleware/imageValidationMiddleware.js';

const router = express.Router();

router.post('/login',       loginProjectManager);
router.get('/me',           verifyToken, allowRoles('project_manager'),                                                   getSelfProjectManager);

router.post('/add',         verifyToken, upload.single('profile_image'), validateImageFile, validateAddProjectManager,    addProjectManager);
router.get('/list',         verifyToken, validateGetAllProjectManagers,                                                   getAllProjectManagers);
router.get('/:id',          verifyToken, validateProjectManagerId,                                                        getProjectManagerById);
router.put('/:id',          verifyToken, upload.single('profile_image'), validateImageFile, validateUpdateProjectManager, updateProjectManager);
router.patch('/:id/status', verifyToken, validateToggleStatus,                                                            toggleStatus);
router.delete('/:id',       verifyToken, validateProjectManagerId,                                                        deleteProjectManager);

export default router;
