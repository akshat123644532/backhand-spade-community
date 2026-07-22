import { body, param, query } from 'express-validator';
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

export const validateAddClient = [
    body('name').notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('country').optional().isLength({ max: 100 }).withMessage('Country name too long'),
    body('contact_no').optional().isMobilePhone().withMessage('Invalid contact number'),
    body('website_url').optional().isURL().withMessage('Invalid website URL'),
    body('api_base_url').optional().isURL().withMessage('Invalid API base URL'),
    body('api_secret_key').optional().isLength({ max: 2000 }).withMessage('API secret key too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateUpdateClient = [
    param('id').isInt({ min: 1 }).withMessage('Invalid client ID'),
    body('name').optional().isLength({ max: 100 }).withMessage('Name too long'),
    body('country').optional().isLength({ max: 100 }).withMessage('Country name too long'),
    body('contact_no').optional().isMobilePhone().withMessage('Invalid contact number'),
    body('website_url').optional().isURL().withMessage('Invalid website URL'),
    body('api_base_url').optional().isURL().withMessage('Invalid API base URL'),
    body('api_secret_key').optional().isLength({ max: 2000 }).withMessage('API secret key too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateClientId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid client ID'),
    validate
];

export const validateGetAllClients = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('country').optional().isLength({ max: 100 }).withMessage('Country filter too long'),
    validate
];