import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';

import {
    createApiKey,
    getAllApiKeys,
    getApiKeyById,
    updateApiKey,
    deleteApiKey,
    updateApiKeyStatus
} from '../controllers/apiKeyController.js';

const router = express.Router();

router.post('/', verifyToken, createApiKey);

router.get('/list', verifyToken, getAllApiKeys);

router.get('/:id', verifyToken, getApiKeyById);

router.put('/update/:id', verifyToken, updateApiKey);

router.delete('/delete/:id', verifyToken, deleteApiKey);

router.patch('/status/:id', verifyToken, updateApiKeyStatus);

export default router;