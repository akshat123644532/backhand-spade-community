import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import csvUploadMiddleware from '../middleware/csvUploadMiddleware.js';
import { toggleLinkMode, getActiveSurveyLink } from '../controllers/projectController.js';


import {
    addProject, getAllProjects, getProjectById,
    updateProject, deleteProject, toggleProjectStatus,
    addProjectUrl, updateProjectUrl, deleteProjectUrl, getProjectUrlList,
    addMultipleUrl, updateMultipleUrl, deleteMultipleUrl,
    uploadMultipleUrlCsv, getMultipleUrlList, getMultiLinkStats, downloadCsvTemplate,
    getMultiLinkCsvImportStatus
} from '../controllers/projectController.js';

const router = express.Router();

// Accept CSV under common field names (file / csv / csvFile)
const csvUploadFlexible = (req, res, next) => {
    const upload = csvUploadMiddleware.fields([
        { name: 'file', maxCount: 1 },
        { name: 'csv', maxCount: 1 },
        { name: 'csvFile', maxCount: 1 }
    ]);

    upload(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message || 'CSV upload failed!' });
        }
        req.file =
            req.file ||
            req.files?.file?.[0] ||
            req.files?.csv?.[0] ||
            req.files?.csvFile?.[0] ||
            null;
        next();
    });
};

// Project CRUD
router.post('/add',                 verifyToken, addProject);
router.get('/list',                 verifyToken, getAllProjects);
router.get('/:id/multi-link-stats', verifyToken, getMultiLinkStats);
router.get('/:id',                  verifyToken, getProjectById);
router.put('/:id',                  verifyToken, updateProject);
router.delete('/:id',               verifyToken, deleteProject);
router.patch('/:id/status',         verifyToken, toggleProjectStatus);

// Project URL Info (+ CSV for Multi Link in same request)
router.get('/:id/url/list',         verifyToken, getProjectUrlList);
router.post('/:id/url',             verifyToken, csvUploadFlexible, addProjectUrl);
router.put('/url/:urlId',           verifyToken, updateProjectUrl);
router.delete('/url/:urlId',        verifyToken, deleteProjectUrl);

// Multiple URLs
router.get('/:id/multiple-url/list', verifyToken, getMultipleUrlList);
router.post('/:id/multiple-url',    verifyToken, addMultipleUrl);
router.put('/multiple-url/:urlId',  verifyToken, updateMultipleUrl);
router.delete('/multiple-url/:urlId', verifyToken, deleteMultipleUrl);

// Multiple URLs — CSV bulk upload + template download + import status
router.get('/multiple-url/csv-template', verifyToken, downloadCsvTemplate);
router.post('/:id/multiple-url/csv-upload', verifyToken, csvUploadFlexible, uploadMultipleUrlCsv);
router.get('/:id/multiple-url/csv-import-status', verifyToken, getMultiLinkCsvImportStatus);
router.patch('/url/:urlId/link-mode', verifyToken, toggleLinkMode);
router.get('/url/:urlId/active-link', getActiveSurveyLink);


export default router;
