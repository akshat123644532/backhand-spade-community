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
    changePassword
} from '../controllers/adminController.js';
import verifyToken from '../middleware/authMiddleware.js';
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

router.get('/me', verifyToken, getSelf);

// Comment: Protect admin creation routes with verifyToken + role checks; open /signup and /add-user allow unauthorized admin creation.
// commment solved cobine into one route with array of paths
router.post(['/signup', '/add-user'], upload.single('image'), validateImageFile, validateSignup, signupAdmin);
router.post('/login', validateLogin, loginAdmin);
router.post('/searchemail', validateSearchEmail, searchEmail);

router.put('/updateadmin/:id', verifyToken, upload.single('image'), validateImageFile, validateUpdateAdmin, updateAdmin);
router.delete('/delete/:id', verifyToken, validateAdminId, deleteAdmin);

router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/verify-otp', validateVerifyOTP, verifyOTP);
router.post('/reset-password', validateResetPassword, resetPassword);

router.get('/all', verifyToken, validateGetAllAdmins, getAllAdmins);
router.get('/:id', verifyToken, validateAdminId, getAdminById);

router.put('/change-password', verifyToken, validateChangePassword, changePassword);

router.post('/logout', verifyToken, logout);
export default router;

