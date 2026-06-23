import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddSalesLog = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    body('comment').notEmpty().withMessage('Comment is required').isLength({ max: 1000 }).withMessage('Comment too long'),
    body('email_subject').optional().isLength({ max: 255 }).withMessage('Email subject too long'),
    body('comment_by').optional().isIn(['Sales', 'Client', 'Manager', 'Other']).withMessage('comment_by must be Sales, Client, Manager or Other'),
    validate
];

export const validateUpdateSalesLog = [
    param('logId').isInt({ min: 1 }).withMessage('Invalid log ID'),
    body('comment').optional().isLength({ max: 1000 }).withMessage('Comment too long'),
    body('email_subject').optional().isLength({ max: 255 }).withMessage('Email subject too long'),
    body('comment_by').optional().isIn(['Sales', 'Client', 'Manager', 'Other']).withMessage('comment_by must be Sales, Client, Manager or Other'),
    validate
];

export const validateSalesLogId = [
    param('logId').isInt({ min: 1 }).withMessage('Invalid log ID'),
    validate
];