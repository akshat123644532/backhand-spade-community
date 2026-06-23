import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    next();
};

export const validateSystemEmailId = [
    param('id').isInt({ min: 1 }).withMessage('Invalid system email ID'),
    validate
];

export const validateUpdateSystemEmail = [
    param('id').isInt({ min: 1 }).withMessage('Invalid system email ID'),
    body('name').optional().isLength({ max: 100 }).withMessage('Name too long'),
    body('system_email').optional().isEmail().withMessage('Invalid email format'),
    body('content').optional().isLength({ min: 1 }).withMessage('Content cannot be empty'),
    validate
];