import express from 'express';
import {
    createContactUs
} from '../controllers/contactUsController.js';

const router = express.Router();

router.post(
    '/contact-us',
    createContactUs
);

export default router;