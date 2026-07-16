import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import csvUploadMiddleware from '../middleware/csvUploadMiddleware.js';
import {
    addProject, getAllProjects, getProjectById,
    updateProject, deleteProject, toggleProjectStatus,
    addProjectUrl, updateProjectUrl, deleteProjectUrl,
    addMultipleUrl, updateMultipleUrl, deleteMultipleUrl,
    uploadMultipleUrlCsv
} from '../controllers/projectController.js';

const router = express.Router();

// Project CRUD
router.post('/add',                 verifyToken, addProject);
router.get('/list',                 verifyToken, getAllProjects);
router.get('/:id',                  verifyToken, getProjectById);
router.put('/:id',                  verifyToken, updateProject);
router.delete('/:id',               verifyToken, deleteProject);
router.patch('/:id/status',         verifyToken, toggleProjectStatus);

// Project URL Info
router.post('/:id/url',             verifyToken, addProjectUrl);
router.put('/url/:urlId',           verifyToken, updateProjectUrl);
router.delete('/url/:urlId',        verifyToken, deleteProjectUrl);

// Multiple URLs
router.post('/:id/multiple-url',    verifyToken, addMultipleUrl);
router.put('/multiple-url/:urlId',  verifyToken, updateMultipleUrl);
router.delete('/multiple-url/:urlId', verifyToken, deleteMultipleUrl);

// Multiple URLs — CSV bulk upload
router.post('/:id/multiple-url/csv-upload', verifyToken, csvUploadMiddleware.single('file'), uploadMultipleUrlCsv);

export default router;