import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import { addSalesProject, getAllSalesProjects, getSalesProjectById, updateSalesProject, deleteSalesProject } from '../controllers/salesProjectController.js';
import { validateAddSalesProject, validateUpdateSalesProject, validateSalesProjectId, validateGetAllSalesProjects } from '../validations/salesProjectValidations.js';

const router = express.Router();

router.post('/add',   verifyToken, validateAddSalesProject,      addSalesProject);
router.get('/list',   verifyToken, validateGetAllSalesProjects,  getAllSalesProjects);
router.get('/:id',    verifyToken, validateSalesProjectId,       getSalesProjectById);
router.put('/:id',    verifyToken, validateUpdateSalesProject,   updateSalesProject);
router.delete('/:id', verifyToken, validateSalesProjectId,       deleteSalesProject);

export default router;

