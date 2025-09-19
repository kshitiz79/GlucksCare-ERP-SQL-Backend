const express = require('express');
const router = express.Router();
const { authMiddleware, adminAuth } = require('../middleware/authMiddleware');
const {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket
} = require('./ticketController');

// GET all tickets (authenticated users)
router.get('/', authMiddleware, getAllTickets);

// GET ticket by ID (authenticated users)
router.get('/:id', authMiddleware, getTicketById);

// CREATE a new ticket (authenticated users)
router.post('/', authMiddleware, createTicket);

// UPDATE a ticket (authenticated users)
router.put('/:id', authMiddleware, updateTicket);

// DELETE a ticket (authenticated users)
router.delete('/:id', authMiddleware, deleteTicket);

module.exports = router;