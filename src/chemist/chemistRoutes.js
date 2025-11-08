const express = require('express');
const router = express.Router();
const {
  getAllChemists,
  getChemistById,
  createChemist,
  updateChemist,
  deleteChemist,
  getChemistsByHeadOffice,
  getMyChemists,
  createBulkChemists
} = require('./chemistController');

const { authMiddleware } = require('../middleware/authMiddleware');

// GET all chemists
router.get('/', authMiddleware, getAllChemists);

// GET chemists by head office ID
router.get('/by-head-office/:headOfficeId', authMiddleware, getChemistsByHeadOffice);

// GET chemists for current user's head offices
router.get('/my-chemists', authMiddleware, getMyChemists);

// GET chemist by ID
router.get('/:id', authMiddleware, getChemistById);

// CREATE a new chemist
router.post('/', authMiddleware, createChemist);

// CREATE bulk chemists
router.post('/bulk', authMiddleware, createBulkChemists);

// UPDATE a chemist
router.put('/:id', authMiddleware, updateChemist);

// DELETE a chemist
router.delete('/:id', authMiddleware, deleteChemist);

module.exports = router;