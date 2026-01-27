// src/mobimgupload/mobImageRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    uploadImage,
    getImages,
    deleteImage,
    updateImage
} = require('./mobImageController');

// Configure multer for memory storage (upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// 1. UPLOAD - POST /api/mobimages - Upload new image with title
router.post('/', upload.single('image'), uploadImage);

// 2. GET - GET /api/mobimages - Get all images
router.get('/', getImages);

// 3. GET - GET /api/mobimages/:id - Get single image by ID
router.get('/:id', getImages);

// 4. UPDATE - PUT /api/mobimages/:id - Update image title or replace image
router.put('/:id', upload.single('image'), updateImage);

// 5. DELETE - DELETE /api/mobimages/:id - Delete image
router.delete('/:id', deleteImage);

module.exports = router;
