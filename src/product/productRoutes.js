const express = require('express');
const router = express.Router();
const multer = require('multer');
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

// GET all products
router.get('/', getAllProducts);

// GET product by ID
router.get('/:id', getProductById);

// CREATE a new product
router.post('/', upload.single('image'), createProduct);

// UPDATE a product
router.put('/:id', upload.single('image'), updateProduct);

// DELETE a product
router.delete('/:id', deleteProduct);

module.exports = router;