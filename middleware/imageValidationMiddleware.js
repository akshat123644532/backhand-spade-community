const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/heic',
    'image/heif'
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];



export const validateImageFile = (req, res, next) => {
    // image optional hai aur upload nahi ki toh skip
    if (!req.file) return next();

    const mimetype = req.file.mimetype.toLowerCase();
    const originalName = req.file.originalname.toLowerCase();
    const ext = '.' + originalName.split('.').pop();

    if (!ALLOWED_MIME_TYPES.includes(mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
        return res.status(400).json({
            success: false,
            message: "Invalid file type! Only JPG, JPEG, PNG, HEIC files are allowed."
        });
    }

    next();
};