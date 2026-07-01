import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddQuestionnaireGroup = [
    body('group_title').notEmpty().withMessage('Group title is required').isLength({ max: 255 }).withMessage('Group title too long'),
    body('language').notEmpty().withMessage('Language is required').isLength({ max: 50 }).withMessage('Language too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    body('question_library_ids').optional().isArray().withMessage('question_library_ids must be an array'),
    body('question_library_ids.*').optional().isInt({ min: 1 }).withMessage('Each question library ID must be a valid integer'),
    validate
];

export const validateUpdateQuestionnaireGroup = [
    param('id').isInt({ min: 1 }).withMessage('Invalid questionnaire group ID'),
    body('group_title').optional().isLength({ max: 255 }).withMessage('Group title too long'),
    body('language').optional().isLength({ max: 50 }).withMessage('Language too long'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    body('question_library_ids').optional().isArray().withMessage('question_library_ids must be an array'),
    body('question_library_ids.*').optional().isInt({ min: 1 }).withMessage('Each question library ID must be a valid integer'),
    validate
];

export const validateQuestionnaireGroupId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid questionnaire group ID'),
    validate
];

export const validateToggleStatus = [
    param('id').isInt({ min: 1 }).withMessage('Invalid questionnaire group ID'),
    body('status').notEmpty().withMessage('Status is required').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateGetAllQuestionnaireGroups = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status filter'),
    query('language').optional().isLength({ max: 50 }).withMessage('Language filter too long'),
    validate
];