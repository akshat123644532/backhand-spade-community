import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    getAllSystemEmails,
    getSystemEmailById,
    updateSystemEmail,
    deleteSystemEmail
} from '../controllers/systemEmailController.js';

const router = express.Router();

router.get('/list',   verifyToken, getAllSystemEmails);
router.get('/:id',    verifyToken, getSystemEmailById);
router.put('/:id',    verifyToken, updateSystemEmail);
router.delete('/:id', verifyToken, deleteSystemEmail);

export default router;
