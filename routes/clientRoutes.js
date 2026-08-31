import express from 'express';
import {
    addClient,
    getAllClients,
    getClientById,
    updateClient,
    deleteClient,
    exportClientsCsv
} from '../controllers/clientController.js';
import verifyToken from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';
import {
    validateAddClient,
    validateUpdateClient,
    validateClientId,
    validateGetAllClients
} from '../validations/clientValidations.js';

const router = express.Router();
const canReadClients = [verifyToken, allowRoles('admin', 'project_manager', 'sales_manager')];
const requireAdmin = [verifyToken, allowRoles('admin')];

router.post('/add', ...requireAdmin, validateAddClient, addClient);
router.get('/all', ...canReadClients, validateGetAllClients, getAllClients);
router.get('/export/csv', ...requireAdmin, exportClientsCsv);
router.get('/:id', ...canReadClients, validateClientId, getClientById);
router.put('/update/:id', ...requireAdmin, validateUpdateClient, updateClient);
router.delete('/delete/:id', ...requireAdmin, validateClientId, deleteClient);
export default router;
