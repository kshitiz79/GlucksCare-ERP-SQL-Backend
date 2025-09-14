const express = require('express');
const router = express.Router();
const {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket
} = require('./ticketController');

// GET all tickets
router.get('/', getAllTickets);

// GET ticket by ID
router.get('/:id', getTicketById);

// CREATE a new ticket
router.post('/', createTicket);

// UPDATE a ticket
router.put('/:id', updateTicket);

// DELETE a ticket
router.delete('/:id', deleteTicket);

module.exports = router;