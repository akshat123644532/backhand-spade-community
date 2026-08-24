import express from 'express';
import { handleSupplierRedirect } from '../controllers/supplierMappingController.js';
const router = express.Router();
router.get('/:hash', handleSupplierRedirect);
export default router;