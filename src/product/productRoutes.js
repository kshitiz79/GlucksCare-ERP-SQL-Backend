const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware, optionalAuth } = require('../middleware/authMiddleware');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require('./productController');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// GET all products (resolves tenant from auth token, x-tenant-slug, x-tenant-id, or subdomain)
router.get('/', optionalAuth, getAllProducts);

// GET product by ID
router.get('/:id', optionalAuth, getProductById);

// CREATE a new product (authenticated company admin/user only)
router.post('/', authMiddleware, upload.single('image'), createProduct);

// UPDATE a product (authenticated company admin/user only)
router.put('/:id', authMiddleware, upload.single('image'), updateProduct);

// DELETE a product (authenticated company admin/user only)
router.delete('/:id', authMiddleware, deleteProduct);

module.exports = router;