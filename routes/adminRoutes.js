import express from 'express';
const router = express.Router();
import { loginAdmin, signupAdmin, searchEmail, updateAdmin, deleteAdmin } from '../controllers/adminController.js';
import verifyToken from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js'; 

router.post('/signup', upload.single('image'), signupAdmin);
router.post('/add-user', upload.single('image'), signupAdmin);

router.post('/login', loginAdmin);
router.post('/searchemail', searchEmail);
router.put('/updateadmin/:id', verifyToken, updateAdmin);
router.delete('/delete/:id', verifyToken, deleteAdmin);

export default router;