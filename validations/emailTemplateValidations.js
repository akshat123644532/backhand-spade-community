import { body, param } from 'express-validator';
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

export const validateEmailTemplateId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid template ID'),
    validate
];

export const validateUpdateEmailTemplate = [
    param('id').isInt({ min: 1 }).withMessage('Invalid template ID'),
    body('title').optional().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
    body('subject').optional().isLength({ min: 1, max: 255 }).withMessage('Subject must be between 1 and 255 characters'),
    body('content').optional().isLength({ min: 1 }).withMessage('Content cannot be empty'),
    validate
];

export const validateUpdateEmailTemplateStatus = [
    param('id').isInt({ min: 1 }).withMessage('Invalid template ID'),
    body('status').notEmpty().withMessage('Status is required').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];