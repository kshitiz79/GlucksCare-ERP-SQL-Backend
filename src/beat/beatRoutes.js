const express = require('express');
const router = express.Router();
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');
const {
  getMyBeats,
  getBeatById,
  createBeat,
  updateBeat,
  deleteBeat,
  getAllBeatsAdmin
} = require('./beatControllers');

// All routes require authentication
router.use(authMiddleware);

// Admin-only view all beats
router.get('/admin/all', adminAuth, getAllBeatsAdmin);

// Standard CRUD operations
router.get('/', getMyBeats);
router.get('/:id', getBeatById);
router.post('/', createBeat);
router.put('/:id', updateBeat);
router.delete('/:id', deleteBeat);

module.exports = router;
