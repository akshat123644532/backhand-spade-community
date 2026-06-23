import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddSurveyGroupProject = [
    body('project_name').notEmpty().withMessage('Project name is required').isLength({ max: 255 }).withMessage('Project name too long'),
    body('client_ids').notEmpty().withMessage('At least one client is required').isArray({ min: 1 }).withMessage('client_ids must be a non-empty array'),
    body('client_ids.*').isInt({ min: 1 }).withMessage('Each client ID must be a valid integer'),
    body('survey_ids').optional().isArray().withMessage('survey_ids must be an array'),
    body('survey_ids.*').optional().isInt({ min: 1 }).withMessage('Each survey ID must be a valid integer'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes too long'),
    validate
];

export const validateUpdateSurveyGroupProject = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    body('project_name').optional().isLength({ max: 255 }).withMessage('Project name too long'),
    body('client_ids').optional().isArray({ min: 1 }).withMessage('client_ids must be a non-empty array'),
    body('client_ids.*').optional().isInt({ min: 1 }).withMessage('Each client ID must be a valid integer'),
    body('survey_ids').optional().isArray().withMessage('survey_ids must be an array'),
    body('survey_ids.*').optional().isInt({ min: 1 }).withMessage('Each survey ID must be a valid integer'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description too long'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes too long'),
    validate
];

export const validateSurveyGroupProjectId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    validate
];

export const validateToggleStatus = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    body('status').notEmpty().withMessage('Status is required').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateGetAllSurveyGroupProjects = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status filter'),
    validate
];

export const validateAddSurveysToGroup = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    body('survey_ids').notEmpty().withMessage('survey_ids is required').isArray({ min: 1 }).withMessage('survey_ids must be a non-empty array'),
    body('survey_ids.*').isInt({ min: 1 }).withMessage('Each survey ID must be a valid integer'),
    validate
];

export const validateRemoveSurveyFromGroup = [
    param('id').isInt({ min: 1 }).withMessage('Invalid project ID'),
    param('surveyId').isInt({ min: 1 }).withMessage('Invalid survey ID'),
    validate
];