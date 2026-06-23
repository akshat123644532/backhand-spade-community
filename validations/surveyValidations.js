import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateAddSurvey = [
    body('project_name').notEmpty().withMessage('Project name is required').isLength({ max: 255 }).withMessage('Project name too long'),
    body('client_id').optional().isInt({ min: 1 }).withMessage('Invalid client ID'),
    body('project_manager_id').optional().isInt({ min: 1 }).withMessage('Invalid project manager ID'),
    body('sales_manager_id').optional().isInt({ min: 1 }).withMessage('Invalid sales manager ID'),
    body('sales_project_id').optional().isInt({ min: 1 }).withMessage('Invalid sales project ID'),
    body('loi').optional().isInt({ min: 1 }).withMessage('LOI must be a positive integer'),
    body('ir').optional().isInt({ min: 0, max: 100 }).withMessage('IR must be between 0 and 100'),
    body('sample_size').optional().isInt({ min: 1 }).withMessage('Sample size must be a positive integer'),
    body('cpi').optional().isFloat({ min: 0 }).withMessage('CPI must be a positive number'),
    body('start_date').optional().isDate().withMessage('Invalid start date'),
    body('end_date').optional().isDate().withMessage('Invalid end date'),
    body('live_url').optional().isURL().withMessage('Invalid live URL'),
    body('test_url').optional().isURL().withMessage('Invalid test URL'),
    body('status').optional().isIn(['active', 'inactive', 'completed', 'paused']).withMessage('Invalid status'),
    validate
];

export const validateUpdateSurvey = [
    param('id').notEmpty().withMessage('Invalid survey ID'),
    body('project_name').optional().isLength({ max: 255 }).withMessage('Project name too long'),
    body('client_id').optional().isInt({ min: 1 }).withMessage('Invalid client ID'),
    body('project_manager_id').optional().isInt({ min: 1 }).withMessage('Invalid project manager ID'),
    body('loi').optional().isInt({ min: 1 }).withMessage('LOI must be a positive integer'),
    body('ir').optional().isInt({ min: 0, max: 100 }).withMessage('IR must be between 0 and 100'),
    body('sample_size').optional().isInt({ min: 1 }).withMessage('Sample size must be a positive integer'),
    body('cpi').optional().isFloat({ min: 0 }).withMessage('CPI must be a positive number'),
    body('start_date').optional().isDate().withMessage('Invalid start date'),
    body('end_date').optional().isDate().withMessage('Invalid end date'),
    body('live_url').optional().isURL().withMessage('Invalid live URL'),
    body('test_url').optional().isURL().withMessage('Invalid test URL'),
    body('status').optional().isIn(['active', 'inactive', 'completed', 'paused']).withMessage('Invalid status'),
    validate
];

export const validateSurveyId = [
    param('id').notEmpty().withMessage('Invalid survey ID'),
    validate
];

export const validateGetAllSurveys = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive', 'completed', 'paused']).withMessage('Invalid status filter'),
    validate
];

export const validateSearchSurveys = [
    query('q').notEmpty().withMessage('Search query is required').isLength({ max: 100 }).withMessage('Search query too long'),
    validate
];

export const validateAssignPartners = [
    param('id').notEmpty().withMessage('Invalid survey ID'),
    body('partner_ids').notEmpty().withMessage('partner_ids is required').isArray({ min: 1 }).withMessage('partner_ids must be a non-empty array'),
    body('partner_ids.*').isInt({ min: 1 }).withMessage('Each partner ID must be a valid integer'),
    validate
];

export const validatePartnerAllocation = [
    param('id').notEmpty().withMessage('Invalid survey ID'),
    param('partnerId').isInt({ min: 1 }).withMessage('Invalid partner ID'),
    body('allocated_size').notEmpty().withMessage('allocated_size is required').isInt({ min: 1 }).withMessage('Allocated size must be a positive integer'),
    validate
];

export const validateAddRecontact = [
    body('parent_survey_id').notEmpty().withMessage('parent_survey_id is required'),
    body('project_name').optional().isLength({ max: 255 }).withMessage('Project name too long'),
    body('loi').optional().isInt({ min: 1 }).withMessage('LOI must be a positive integer'),
    body('ir').optional().isInt({ min: 0, max: 100 }).withMessage('IR must be between 0 and 100'),
    body('sample_size').optional().isInt({ min: 1 }).withMessage('Sample size must be a positive integer'),
    body('cpi').optional().isFloat({ min: 0 }).withMessage('CPI must be a positive number'),
    body('start_date').optional().isDate().withMessage('Invalid start date'),
    body('end_date').optional().isDate().withMessage('Invalid end date'),
    body('live_url').optional().isURL().withMessage('Invalid live URL'),
    body('test_url').optional().isURL().withMessage('Invalid test URL'),
    validate
];