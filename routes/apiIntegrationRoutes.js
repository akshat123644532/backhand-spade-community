import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import {
    listApiIntegrations,
    getApiIntegrationByName,
    upsertApiIntegration,
} from '../controllers/apiIntegrationController.js';

const router = express.Router();

router.get('/', verifyToken, listApiIntegrations);
router.get('/:name', verifyToken, getApiIntegrationByName);
router.put('/', verifyToken, upsertApiIntegration);
router.post('/', verifyToken, upsertApiIntegration);

export default router;
