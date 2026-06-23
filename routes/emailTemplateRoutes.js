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
    validateEmailTemplateId,
    validateUpdateEmailTemplate,
    validateUpdateEmailTemplateStatus
} from '../validations/emailTemplateValidations.js';

const router = express.Router();

router.get('/list',         verifyToken, getAllEmailTemplates);
router.get('/:id',          verifyToken, validateEmailTemplateId,             getEmailTemplateById);
router.put('/:id',          verifyToken, validateUpdateEmailTemplate,          updateEmailTemplate);
router.patch('/:id/status', verifyToken, validateUpdateEmailTemplateStatus,    updateEmailTemplateStatus);
router.delete('/:id',       verifyToken, validateEmailTemplateId,             deleteEmailTemplate);

export default router;