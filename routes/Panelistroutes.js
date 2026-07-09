import express from 'express';
import multer from 'multer';
import verifyToken from '../middleware/authMiddleware.js';
import { signup, activateAccount, login, getAllPanelists, getPanelistById, updatePanelist, deletePanelist, toggleStatus } from '../controllers/Panelistcontroller.js';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();

router.post('/signup',         upload.single('photo'), signup);
router.get('/activate/:token', activateAccount);
router.post('/login',          login);
router.get('/list',            verifyToken, getAllPanelists);
router.get('/:id',             verifyToken, getPanelistById);
router.put('/:id',             verifyToken, upload.single('photo'), updatePanelist);
router.delete('/:id',          verifyToken, deletePanelist);
router.patch('/:id/status',    verifyToken, toggleStatus);

export default router;