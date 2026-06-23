import express from 'express';
import verifyToken from '../Middleware/authMIddleware.js';
import { getAllCountries, getCountryById } from '../controllers/countryController.js';
import {
    validateGetAllCountries,
    validateCountryId
} from '../validations/countryValidations.js';

const router = express.Router();

router.get('/list', verifyToken, validateGetAllCountries, getAllCountries);
router.get('/:id', verifyToken, validateCountryId, getCountryById);

export default router;