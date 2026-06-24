import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addPrescreen, getAllPrescreens, getPrescreenById, getByLanguage, updatePrescreen, toggleStatus, deletePrescreen } from '../controllers/prescreenController.js';
import { validateAddPrescreen, validateUpdatePrescreen, validatePrescreenId, validateToggleStatus, validateGetAllPrescreens, validateGetByLanguage } from '../validations/prescreenValidations.js';

const router = express.Router();

router.post('/add',                 verifyToken, validateAddPrescreen,     addPrescreen);
router.get('/list',                 verifyToken, validateGetAllPrescreens, getAllPrescreens);
router.get('/language/:language',   verifyToken, validateGetByLanguage,    getByLanguage);
router.get('/:id',                  verifyToken, validatePrescreenId,      getPrescreenById);
router.put('/:id',                  verifyToken, validateUpdatePrescreen,  updatePrescreen);
router.patch('/:id/status',         verifyToken, validateToggleStatus,     toggleStatus);
router.delete('/:id',               verifyToken, validatePrescreenId,      deletePrescreen);

export default router;


