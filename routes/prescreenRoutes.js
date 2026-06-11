import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    addPrescreen, getAllPrescreens, getPrescreenById,
    getByLanguage, updatePrescreen, toggleStatus, deletePrescreen
} from '../controllers/prescreenController.js';

const router = express.Router();

router.post('/add', verifyToken, addPrescreen);
router.get('/list', verifyToken, getAllPrescreens);
router.get('/language/:language', verifyToken, getByLanguage);
router.get('/:id', verifyToken, getPrescreenById);
router.put('/:id', verifyToken, updatePrescreen);
router.patch('/:id/status', verifyToken, toggleStatus);
router.delete('/:id', verifyToken, deletePrescreen);

export default router;