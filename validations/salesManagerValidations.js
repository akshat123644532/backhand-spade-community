import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddSalesManager = [
    body('name').notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name too long'),
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    // body('confirm_password').notEmpty().withMessage('Confirm password is required').custom((value, { req }) => {
    //     if (value !== req.body.password) throw new Error('Passwords do not match');
    //     return true;
    // }),
    validate
];

export const validateUpdateSalesManager = [
    param('id').isInt({ min: 1 }).withMessage('Invalid sales manager ID'),
    body('name').optional().isLength({ max: 100 }).withMessage('Name too long'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('new_password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
];

export const validateSalesManagerId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid sales manager ID'),
    validate
];

export const validateToggleStatus = [
    param('id').isInt({ min: 1 }).withMessage('Invalid sales manager ID'),
    body('status').notEmpty().withMessage('Status is required').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateGetAllSalesManagers = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status filter'),
    validate
];