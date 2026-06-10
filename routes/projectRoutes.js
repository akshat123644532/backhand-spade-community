import express from 'express';
import { getDropdowns, addProject, listProjects } from '../controllers/projectController.js';

import verifyToken from '../Middleware/authMIddleware.js';

const router = express.Router();


router.get('/dropdowns', verifyToken, getDropdowns);
router.post('/add', verifyToken, addProject);
router.get('/list', verifyToken, listProjects);

export default router;