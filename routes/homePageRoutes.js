import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import {
    getAllSettings,
    getSectionSetting,
    upsertSection,
    deleteSection,
    deleteField
} from '../controllers/homePageController.js';

const router = express.Router();

router.get('/list',                         verifyToken, getAllSettings);
router.get('/:section',                     verifyToken, getSectionSetting);
router.put('/:section',                     verifyToken, upsertSection);
router.delete('/:section',                  verifyToken, deleteSection);
router.delete('/:section/:field_key',       verifyToken, deleteField);

export default router;