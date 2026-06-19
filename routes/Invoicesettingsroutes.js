import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import upload from '../Middleware/uploadMiddleware.js';
import {
    getInvoiceSettings,
    updateInvoiceSettings
} from '../controllers/invoiceSettingsController.js';

const router = express.Router();

router.get('/',   verifyToken, getInvoiceSettings);
router.put('/',   verifyToken, upload.single('logo_image'), updateInvoiceSettings);

export default router;