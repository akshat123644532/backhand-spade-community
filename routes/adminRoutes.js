import express from 'express';
import { changePassword } from '../controllers/adminController.js';
const router = express.Router();
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
    getSelf
} from '../controllers/adminController.js';
import verifyToken from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js'; 
router.get('/me', verifyToken, getSelf);
router.post('/signup', upload.single('image'), signupAdmin);
router.post('/add-user', upload.single('image'), signupAdmin);
router.post('/login', loginAdmin);
router.post('/searchemail', searchEmail);

router.put('/updateadmin/:id', verifyToken, updateAdmin);
router.delete('/delete/:id', verifyToken, deleteAdmin);

router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

router.get('/all', verifyToken, getAllAdmins);
router.get('/:id', verifyToken, getAdminById);

router.put('/change-password', verifyToken, changePassword);
export default router;