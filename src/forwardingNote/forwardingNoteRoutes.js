// src/forwardingNote/forwardingNoteRoutes.js

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
    getAllForwardingNotes,
    getForwardingNoteById,
    createForwardingNote,
    updateForwardingNote,
    deleteForwardingNote
} = require('./forwardingNoteController');

// GET route for specific forwarding note (Public - for QR scan)
router.get('/public/:id', getForwardingNoteById);

// Apply authentication middleware to remaining routes
router.use(authMiddleware);

// GET routes
router.get('/', getAllForwardingNotes);
router.get('/:id', getForwardingNoteById);

// POST routes
router.post('/', createForwardingNote);

// PUT routes
router.put('/:id', updateForwardingNote);

// DELETE routes
router.delete('/:id', deleteForwardingNote);

module.exports = router;
