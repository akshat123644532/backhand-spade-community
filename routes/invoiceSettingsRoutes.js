import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import {
    getInvoiceSettings,
    updateInvoiceSettings
} from '../controllers/invoiceSettingsController.js';
import { validateUpdateInvoiceSettings } from '../validations/invoiceSettingsValidations.js';
import { validateImageFile } from '../middleware/imageValidationMiddleware.js';

const router = express.Router();

router.get('/', verifyToken, getInvoiceSettings);
router.put('/', verifyToken, upload.single('logo_image'), validateImageFile, validateUpdateInvoiceSettings, updateInvoiceSettings);

export default router;