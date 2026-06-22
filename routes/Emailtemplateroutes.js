import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    getAllEmailTemplates,
    getEmailTemplateById,
    updateEmailTemplate,
    updateEmailTemplateStatus,  
    deleteEmailTemplate         
} from '../controllers/emailTemplateController.js';

const router = express.Router();

router.get('/list',           verifyToken, getAllEmailTemplates);
router.get('/:id',            verifyToken, getEmailTemplateById);
router.put('/:id',            verifyToken, updateEmailTemplate);
router.patch('/:id/status',   verifyToken, updateEmailTemplateStatus); 
router.delete('/:id',         verifyToken, deleteEmailTemplate);        

export default router;