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

router.post('/add', verifyToken, addClient);
router.get('/all', verifyToken, getAllClients);
router.get('/:id', verifyToken, getClientById);
router.put('/update/:id', verifyToken, updateClient);
router.delete('/delete/:id', verifyToken, deleteClient);

export default router;