import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddPrescreen = [
    body('language').notEmpty().withMessage('Language is required').isLength({ max: 50 }).withMessage('Language too long'),
    body('question_title').notEmpty().withMessage('Question title is required').isLength({ max: 500 }).withMessage('Question title too long'),
    body('options').notEmpty().withMessage('Options are required').isArray({ min: 1 }).withMessage('At least one option is required'),
    body('right_answer').optional().isLength({ max: 255 }).withMessage('Right answer too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateUpdatePrescreen = [
    param('id').isInt({ min: 1 }).withMessage('Invalid prescreen ID'),
    body('language').optional().isLength({ max: 50 }).withMessage('Language too long'),
    body('question_title').optional().isLength({ max: 500 }).withMessage('Question title too long'),
    body('options').optional().isArray({ min: 1 }).withMessage('At least one option is required'),
    body('right_answer').optional().isLength({ max: 255 }).withMessage('Right answer too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validatePrescreenId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid prescreen ID'),
    validate
];

export const validateToggleStatus = [
    param('id').isInt({ min: 1 }).withMessage('Invalid prescreen ID'),
    body('status').notEmpty().withMessage('Status is required').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateGetAllPrescreens = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status filter'),
    query('language').optional().isLength({ max: 50 }).withMessage('Language filter too long'),
    validate
];

export const validateGetByLanguage = [
    param('language').notEmpty().withMessage('Language is required').isLength({ max: 50 }).withMessage('Language too long'),
    validate
];