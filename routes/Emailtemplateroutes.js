import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    getAllEmailTemplates,
    getEmailTemplateById,
    updateEmailTemplate
} from '../controllers/emailTemplateController.js';

const router = express.Router();

router.get('/list',   verifyToken, getAllEmailTemplates);
router.get('/:id',    verifyToken, getEmailTemplateById);
router.put('/:id',    verifyToken, updateEmailTemplate);

export default router;