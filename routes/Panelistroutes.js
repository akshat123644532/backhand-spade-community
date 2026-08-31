import express from 'express';
import multer from 'multer';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import { forgotPassword, resetPassword } from '../controllers/panelistPortalController.js';
import {
    signup,
    activateAccount,
    login,
    getAllPanelists,
    getPanelistById,
    updatePanelist,
    deletePanelist,
    toggleStatus,
    resendInviteEmail,
    sendBulkInviteEmails
} from '../controllers/Panelistcontroller.js';
import { logout } from '../controllers/authController.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();
const requireAdmin = [verifyToken, allowRoles('admin')];

router.post('/signup', upload.single('photo'), signup);
router.get('/activate/:token', activateAccount);
router.post('/login', login);
router.get('/list', ...requireAdmin, getAllPanelists);
router.get('/:id', ...requireAdmin, getPanelistById);
router.put('/:id', ...requireAdmin, upload.single('photo'), updatePanelist);
router.delete('/:id', ...requireAdmin, deletePanelist);
router.patch('/:id/status', ...requireAdmin, toggleStatus);
router.post('/:id/resend-invite', ...requireAdmin, resendInviteEmail);
router.post('/bulk-invite', ...requireAdmin, sendBulkInviteEmails);
router.post('/logout', verifyToken, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
