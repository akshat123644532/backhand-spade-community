import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

//middeware
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

//validation define ho rhe hn 
export const validateLogin = [
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
];

export const validateSignup = [
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').optional().isLength({ max: 100 }).withMessage('Name too long'),
    body('contact_no').optional().isMobilePhone().withMessage('Invalid contact number'),
    body('permission_type').optional().isIn(['user', 'admin', 'superadmin', 'moderator']).withMessage('Invalid permission type'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateSearchEmail = [
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    validate
];

export const validateUpdateAdmin = [
    param('id').isInt({ min: 1 }).withMessage('Invalid admin ID'),
    body('name').optional().isLength({ max: 100 }).withMessage('Name too long'),
    body('permission_type').optional().isIn(['user', 'admin', 'superadmin', 'moderator']).withMessage('Invalid permission type'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    validate
];

export const validateAdminId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid admin ID'),
    validate
];

export const validateForgotPassword = [
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    validate
];

export const validateVerifyOTP = [
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('otp').notEmpty().withMessage('OTP is required').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits').isNumeric().withMessage('OTP must be numeric'),
    validate
];

export const validateResetPassword = [
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email format'),
    body('otp').notEmpty().withMessage('OTP is required').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
];

export const validateGetAllAdmins = [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status filter'),
    validate
];

export const validateChangePassword = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').notEmpty().withMessage('Confirm password is required').custom((value, { req }) => {
        if (value !== req.body.newPassword) throw new Error('Passwords do not match');
        return true;
    }),
    validate
];