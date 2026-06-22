import express from 'express';
const router = express.Router();
import {
    addClient,
    getAllClients,
    getClientById,
    updateClient,
    deleteClient
} from '../controllers/clientController.js';
import verifyToken from '../middleware/authMiddleware.js';
import {
    validateAddClient,
    validateUpdateClient,
    validateClientId,
    validateGetAllClients
} from '../validations/clientValidations.js';

router.post('/add', verifyToken, validateAddClient, addClient);
router.get('/all', verifyToken, validateGetAllClients, getAllClients);
router.get('/:id', verifyToken, validateClientId, getClientById);
router.put('/update/:id', verifyToken, validateUpdateClient, updateClient);
router.delete('/delete/:id', verifyToken, validateClientId, deleteClient);

export default router;