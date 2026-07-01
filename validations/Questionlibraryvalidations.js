import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddLibraryQuestion = [
    body('language').notEmpty().withMessage('Language is required').isLength({ max: 50 }).withMessage('Language too long'),
    body('question_title').notEmpty().withMessage('Question title is required').isLength({ max: 500 }).withMessage('Question title too long'),
    body('question_type').notEmpty().withMessage('Question type is required').isIn(['textbox', 'textarea', 'checkbox', 'dropdown', 'radio']).withMessage('Invalid question type'),
    body('options').optional().isArray({ min: 1 }).withMessage('At least one option is required'),
    body('right_answer').optional().isLength({ max: 255 }).withMessage('Right answer too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    body('sort_order').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
    validate
];

export const validateUpdateLibraryQuestion = [
    param('id').isInt({ min: 1 }).withMessage('Invalid library question ID'),
    body('language').optional().isLength({ max: 50 }).withMessage('Language too long'),
    body('question_title').optional().isLength({ max: 500 }).withMessage('Question title too long'),
    body('question_type').optional().isIn(['textbox', 'textarea', 'checkbox', 'dropdown', 'radio']).withMessage('Invalid question type'),
    body('options').optional().isArray({ min: 1 }).withMessage('At least one option is required'),
    body('right_answer').optional().isLength({ max: 255 }).withMessage('Right answer too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    body('sort_order').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
    validate
];

export const validateLibraryQuestionId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid library question ID'),
    validate
];

export const validateToggleStatus = [
    param('id').isInt({ min: 1 }).withMessage('Invalid library question ID'),
    body('status').notEmpty().withMessage('Status is required').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateGetAllLibraryQuestions = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional(),
    query('status').optional().custom(value => {
        if (value === '' || ['active', 'inactive'].includes(value)) return true;
        throw new Error('Invalid status filter');
    }),
    query('language').optional().custom(value => {
        if (value === '' || value.length <= 50) return true;
        throw new Error('Language filter too long');
    }),
    validate
];

export const validateGetByLanguage = [
    param('language').notEmpty().withMessage('Language is required').isLength({ max: 50 }).withMessage('Language too long'),
    validate
];