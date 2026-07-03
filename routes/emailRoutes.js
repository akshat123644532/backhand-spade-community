import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';

import {
    getAllEmailTemplates,
    getEmailTemplateById,
    updateEmailTemplate,
    updateEmailTemplateStatus,
    deleteEmailTemplate
} from '../controllers/emailTemplateController.js';

import {
    getAllSystemEmails,
    getSystemEmailById,
    updateSystemEmail,
    deleteSystemEmail
} from '../controllers/systemEmailController.js';

const router = express.Router();

router.get('/templates',                verifyToken, getAllEmailTemplates);
router.get('/templates/:id',            verifyToken, getEmailTemplateById);
router.put('/templates/:id',            verifyToken, updateEmailTemplate);
router.patch('/templates/:id/status',   verifyToken, updateEmailTemplateStatus);
router.delete('/templates/:id',         verifyToken, deleteEmailTemplate);


router.get('/system',                   verifyToken, getAllSystemEmails);
router.get('/system/:id',               verifyToken, getSystemEmailById);
router.put('/system/:id',               verifyToken, updateSystemEmail);
router.delete('/system/:id',            verifyToken, deleteSystemEmail);

export default router;