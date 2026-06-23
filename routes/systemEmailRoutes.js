import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import { getAllSystemEmails, getSystemEmailById, updateSystemEmail, deleteSystemEmail } from '../controllers/systemEmailController.js';
import { validateSystemEmailId, validateUpdateSystemEmail } from '../validations/systemEmailValidations.js';

const router = express.Router();

router.get('/list',   verifyToken,                        getAllSystemEmails);
router.get('/:id',    verifyToken, validateSystemEmailId,     getSystemEmailById);
router.put('/:id',    verifyToken, validateUpdateSystemEmail, updateSystemEmail);
router.delete('/:id', verifyToken, validateSystemEmailId,     deleteSystemEmail);

export default router;
