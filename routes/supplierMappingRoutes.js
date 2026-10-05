import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import {
    addSupplierMapping,
    getAllSupplierMappings,
    getMySupplierMappings,
    getSupplierMappingById,
    updateSupplierMapping,
    toggleSupplierMappingStatus,
    toggleSupplierIsTest,
    deleteSupplierMapping
} from '../controllers/supplierMappingController.js';

const router = express.Router();

router.post('/',            verifyToken, addSupplierMapping);
router.get('/list',         verifyToken, getAllSupplierMappings);
router.get('/my-mappings',  verifyToken, allowRoles('partner'), getMySupplierMappings);
router.get('/:id',          verifyToken, getSupplierMappingById);
router.put('/:id',          verifyToken, updateSupplierMapping);
router.patch('/status/:id', verifyToken, toggleSupplierMappingStatus);
router.patch('/istest/:id', verifyToken, toggleSupplierIsTest);
router.delete('/:id',       verifyToken, deleteSupplierMapping);

export default router;
