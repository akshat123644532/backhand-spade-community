import express from 'express';
import {
    loginAdmin,
    signupAdmin,
    searchEmail,
    updateAdmin,
    deleteAdmin,
    forgotPassword,
    verifyOTP,
    resetPassword,
    getAllAdmins,
    getAdminById,
    getSelf,
    changePassword,
    exportAdminsCsv
} from '../controllers/adminController.js';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import { validateImageFile } from '../middleware/imageValidationMiddleware.js';
import {
    validateLogin,
    validateSignup,
    validateSearchEmail,
    validateUpdateAdmin,
    validateAdminId,
    validateForgotPassword,
    validateVerifyOTP,
    validateResetPassword,
    validateGetAllAdmins,
    validateChangePassword
} from '../validations/adminValidations.js';
import { logout } from '../controllers/authController.js';

const router = express.Router();
const requireAdmin = [verifyToken, allowRoles('admin')];

router.get('/me', ...requireAdmin, getSelf);

router.post(['/signup', '/add-user'], ...requireAdmin, upload.single('image'), validateImageFile, validateSignup, signupAdmin);
router.post('/login', validateLogin, loginAdmin);
router.post('/searchemail', ...requireAdmin, validateSearchEmail, searchEmail);

router.put('/updateadmin/:id', ...requireAdmin, upload.single('image'), validateImageFile, validateUpdateAdmin, updateAdmin);
router.delete('/delete/:id', ...requireAdmin, validateAdminId, deleteAdmin);

router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/verify-otp', validateVerifyOTP, verifyOTP);
router.post('/reset-password', validateResetPassword, resetPassword);

router.get('/all', ...requireAdmin, validateGetAllAdmins, getAllAdmins);
router.get('/export/csv', ...requireAdmin, exportAdminsCsv);
router.get('/:id', ...requireAdmin, validateAdminId, getAdminById);
router.put('/change-password', ...requireAdmin, validateChangePassword, changePassword);
router.post('/logout', ...requireAdmin, logout);

export default router;
