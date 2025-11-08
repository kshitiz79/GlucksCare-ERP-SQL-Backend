const express = require('express');
const router = express.Router();
const {
  getAllStockists,
  getStockistById,
  createStockist,
  updateStockist,
  deleteStockist,
  getStockistsByHeadOffice,
  getMyStockists,
  createBulkStockists
} = require('./stockistController');

const { authMiddleware } = require('../middleware/authMiddleware');

// GET all stockists
router.get('/', authMiddleware, getAllStockists);

// GET stockists by head office ID
router.get('/by-head-office/:headOfficeId', authMiddleware, getStockistsByHeadOffice);

// GET stockists for current user's head offices
router.get('/my-stockists', authMiddleware, getMyStockists);

// GET stockist by ID
router.get('/:id', authMiddleware, getStockistById);

// CREATE a new stockist
router.post('/', authMiddleware, createStockist);

// CREATE bulk stockists
router.post('/bulk', authMiddleware, createBulkStockists);

// UPDATE a stockist
router.put('/:id', authMiddleware, updateStockist);

// DELETE a stockist
router.delete('/:id', authMiddleware, deleteStockist);

module.exports = router;