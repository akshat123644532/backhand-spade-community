import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddSalesProject = [
    body('client_name').notEmpty().withMessage('Client name is required').isLength({ max: 100 }).withMessage('Client name too long'),
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('country').optional().isLength({ max: 100 }).withMessage('Country too long'),
    body('email_subject').optional().isLength({ max: 255 }).withMessage('Email subject too long'),
    body('status').optional().isIn(['wip', 'lost', 'won']).withMessage('Status must be wip, lost or won'),
    body('comment').optional().isLength({ max: 1000 }).withMessage('Comment too long'),
    body('sales_manager_id').optional().isInt({ min: 1 }).withMessage('Invalid sales manager ID'),
    validate
];

export const validateUpdateSalesProject = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    body('client_name').optional().isLength({ max: 100 }).withMessage('Client name too long'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('country').optional().isLength({ max: 100 }).withMessage('Country too long'),
    body('email_subject').optional().isLength({ max: 255 }).withMessage('Email subject too long'),
    body('status').optional().isIn(['wip', 'lost', 'won']).withMessage('Status must be wip, lost or won'),
    body('comment').optional().isLength({ max: 1000 }).withMessage('Comment too long'),
    body('sales_manager_id').optional().isInt({ min: 1 }).withMessage('Invalid sales manager ID'),
    validate
];

export const validateSalesProjectId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    validate
];

export const validateGetAllSalesProjects = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['wip', 'lost', 'won']).withMessage('Status must be wip, lost or won'),
    query('country').optional().isLength({ max: 100 }).withMessage('Country filter too long'),
    validate
];