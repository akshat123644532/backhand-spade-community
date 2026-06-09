import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addSalesProject,
    getAllSalesProjects,
    getSalesProjectById,
    updateSalesProject,
    deleteSalesProject
} from '../controllers/salesProjectController.js';

const router = express.Router();

router.post('/add', verifyToken, addSalesProject);
router.get('/list', verifyToken, getAllSalesProjects);
router.get('/:id', verifyToken, getSalesProjectById);
router.put('/:id', verifyToken, updateSalesProject);
router.delete('/:id', verifyToken, deleteSalesProject);

export default router;