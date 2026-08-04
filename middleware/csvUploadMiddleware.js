import multer from 'multer';
import path from 'path';
import fs from 'fs';

const csvDir = 'uploads/csv';
if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, csvDir);
    },
    filename: (req, file, cb) => {
        cb(null, `vendor-urls-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const ok =
        name.endsWith('.csv') ||
        mime.includes('csv') ||
        mime === 'application/vnd.ms-excel' ||
        mime === 'application/octet-stream' ||
        mime === 'text/plain';

    if (ok) cb(null, true);
    else cb(new Error('Only CSV files are allowed!'), false);
};

const csvUploadMiddleware = multer({ storage, fileFilter });

export default csvUploadMiddleware;