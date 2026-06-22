import { param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: errors.array()[0].msg,
            errors: errors.array()
        });
    }
    next();
};

export const validateGetAllCountries = [
    query('search').optional().isLength({ max: 100 }).withMessage('Search query too long'),
    validate
];

export const validateCountryId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid country ID'),
    validate
];