import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addPartner, getAllPartners, getPartnerById, updatePartner, deletePartner } from '../controllers/partnerController.js';

const router = express.Router();

router.post('/add', verifyToken, addPartner);           
router.get('/list', verifyToken, getAllPartners);        
router.get('/:id', verifyToken, getPartnerById);      
router.put('/:id', verifyToken, updatePartner); 


router.delete('/:id', verifyToken, deletePartner);      

export default router;