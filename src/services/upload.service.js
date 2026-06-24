// src/services/upload.service.js

const uploadMiddleware = require('../middleware/upload');

class UploadService {
    // Multer upload middleware references
    static get uploadSingle() {
        return uploadMiddleware.single.bind(uploadMiddleware);
    }
    
    static get uploadArray() {
        return uploadMiddleware.array.bind(uploadMiddleware);
    }

    static get uploadAny() {
        return uploadMiddleware.any.bind(uploadMiddleware);
    }
}

module.exports = UploadService;
