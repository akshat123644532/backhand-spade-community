import { body } from 'express-validator';
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

export const validateUpdateInvoiceSettings = [
    body('address').optional().isLength({ max: 500 }).withMessage('Address too long'),
    body('payment_term').optional().isLength({ max: 255 }).withMessage('Payment term too long'),
    body('footer_content').optional().isLength({ max: 1000 }).withMessage('Footer content too long'),
    validate
];