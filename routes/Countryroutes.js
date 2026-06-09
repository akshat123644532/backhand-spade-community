import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import { getAllCountries, getCountryById } from '../controllers/countryController.js';

const router = express.Router();

router.get('/list', verifyToken, getAllCountries);
router.get('/:id', verifyToken, getCountryById);

export default router;