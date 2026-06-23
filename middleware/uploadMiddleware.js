import multer from 'multer';
import path from 'path';

export const IMAGE_STORAGE_MODE = process.env.IMAGE_STORAGE === 'blob' ? 'blob' : 'path';

const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const storage = IMAGE_STORAGE_MODE === 'blob'
    ? multer.memoryStorage()
    : diskStorage;

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Sirf images allowed hain!'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }
});

export default upload;
