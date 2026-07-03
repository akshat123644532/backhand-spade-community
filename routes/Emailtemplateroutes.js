import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import {
    addEmailTemplate,
    getAllEmailTemplates,
    getEmailTemplateById,
    getEmailTemplateByKey,
    updateEmailTemplate,
    deleteEmailTemplate,
    previewEmailTemplate
} from '../controllers/Emailtemplatecontroller.js';

const router = express.Router();

router.post('/add',              verifyToken, addEmailTemplate);
router.get('/list',              verifyToken, getAllEmailTemplates);
router.get('/key/:key',          verifyToken, getEmailTemplateByKey);
router.post('/key/:key/preview', verifyToken, previewEmailTemplate);
router.get('/:id',               verifyToken, getEmailTemplateById);
router.put('/:id',               verifyToken, updateEmailTemplate);
router.delete('/:id',            verifyToken, deleteEmailTemplate);

export default router;