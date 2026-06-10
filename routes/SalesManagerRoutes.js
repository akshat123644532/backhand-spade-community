import express from 'express';
import { 
    addSalesManager, 
    getAllSalesManagers, 
    getSalesManagerById, 
    updateSalesManager, 
    toggleStatus, 
    deleteSalesManager 
} from '../controllers/salesManagerController.js';

import verifyToken from '../Middleware/authMIddleware.js';; 
import upload from '../middleware/uploadMiddleware.js'; 
const router = express.Router();

router.post('/', verifyToken, upload.single('profile_image'), addSalesManager);
router.get('/list', verifyToken, getAllSalesManagers);
router.get('/:id', verifyToken, getSalesManagerById);
router.put('/:id', verifyToken, upload.single('profile_image'), updateSalesManager);
router.put('/status/:id', verifyToken, toggleStatus);
router.delete('/:id', verifyToken, deleteSalesManager);

export default router;