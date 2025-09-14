const express = require('express');
const router = express.Router();
const {
  getAllStates,
  getStateById,
  createState,
  updateState,
  deleteState
} = require('./stateController');

// GET all states
router.get('/', getAllStates);

// GET state by ID
router.get('/:id', getStateById);

// CREATE a new state
router.post('/', createState);

// UPDATE a state
router.put('/:id', updateState);

// DELETE a state
router.delete('/:id', deleteState);

module.exports = router;