import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import upload from '../Middleware/uploadMiddleware.js';
import {
    addProjectManager,
    getAllProjectManagers,
    getProjectManagerById,
    updateProjectManager,
    toggleStatus,
    deleteProjectManager
} from '../controllers/projectManagerController.js';

const router = express.Router();

router.post('/add', verifyToken, upload.single('profile_image'), addProjectManager);
router.get('/list', verifyToken, getAllProjectManagers);
router.get('/:id', verifyToken, getProjectManagerById);
router.put('/:id', verifyToken, upload.single('profile_image'), updateProjectManager);
router.patch('/:id/status', verifyToken, toggleStatus);
router.delete('/:id', verifyToken, deleteProjectManager);

export default router;