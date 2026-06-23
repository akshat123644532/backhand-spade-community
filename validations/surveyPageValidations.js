import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateSurveyPageId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid survey page ID'),
    validate
];

export const validateUpdateSurveyPage = [
    param('id').isInt({ min: 1 }).withMessage('Invalid survey page ID'),
    body('complete_content').optional().isLength({ min: 1 }).withMessage('Complete content cannot be empty'),
    body('terminate_content').optional().isLength({ min: 1 }).withMessage('Terminate content cannot be empty'),
    body('overquota_content').optional().isLength({ min: 1 }).withMessage('Overquota content cannot be empty'),
    body('quality_term_content').optional().isLength({ min: 1 }).withMessage('Quality term content cannot be empty'),
    body('survey_close_content').optional().isLength({ min: 1 }).withMessage('Survey close content cannot be empty'),
    validate
];